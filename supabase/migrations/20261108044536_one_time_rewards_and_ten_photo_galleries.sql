-- Existing claims remain intact; a receipt makes a network retry idempotent.
alter table public.reward_claims add column if not exists request_id uuid;
create unique index if not exists reward_claims_request_id
  on public.reward_claims(request_id) where request_id is not null;

create or replace function public.goove_select_reward(
  p_action text, p_hash text, p_reward_id uuid default null,
  p_request_id uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  a public.purchase_access_codes%rowtype;
  c public.reward_claims%rowtype;
  r public.reward_codes%rowtype;
  g public.gift_types%rowtype;
  s public.goove_settings%rowtype;
  result jsonb;
  next_code text;
begin
  if p_action not in ('verify','reserve') then raise exception 'Invalid request.'; end if;
  -- Refresh and selection use the same lock order, avoiding a refresh deadlock.
  select * into s from public.goove_settings where id=true for share;
  select * into a from public.purchase_access_codes where code_hash=p_hash for update;
  if not found or a.status='revoked' then
    raise exception 'This access code is invalid or unavailable.';
  end if;
  select * into c from public.reward_claims where purchase_access_code_id=a.id for update;
  if found then
    if p_action<>'reserve' or p_request_id is null or c.request_id is distinct from p_request_id or c.reward_code_id is distinct from p_reward_id then
      raise exception 'This access code has already been used. Ask Goove for a new access code.';
    end if;
    if c.status='verified' and c.expires_at<=now() then
      update public.reward_claims set status='expired' where id=c.id returning * into c;
    end if;
    return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
  end if;
  if a.status<>'active' or a.used_at is not null or a.expires_at<=now() then
    raise exception 'This access code is invalid, expired, or already used.';
  end if;
  if not s.promotion_enabled or not s.legal_reviewed then
    raise exception 'Reward registration is not open yet. Please contact our team.';
  end if;
  if p_action='verify' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select rc.id,'GIFT-••••••••'::text as code,rc.status,null::text as benefit
      from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id
      where rc.status='available' and gt.active order by random()
    ) x;
    return jsonb_build_object('codes',result);
  end if;
  -- A competing customer waits here, then reads the newly rotated code.
  select * into r from public.reward_codes where id=p_reward_id for update;
  if not found or r.status<>'available' then
    raise exception 'This promo code is no longer available. Please refresh the list.';
  end if;
  select * into g from public.gift_types where id=r.gift_type_id for share;
  if not g.active then raise exception 'This promo is unavailable. Please choose another code.'; end if;
  insert into public.reward_claims(purchase_access_code_id,reward_code_id,selected_code,selected_at,benefit_name,discount_percent,purchase_reference,request_id)
    values(a.id,r.id,r.code,clock_timestamp(),g.name,g.discount_percent,a.purchase_reference,p_request_id) returning * into c;
  insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at)
    values(r.code,r.gift_type_id,'used',r.created_at,c.id,c.selected_at);
  loop
    next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.reward_codes where code=next_code)
      and not exists(select 1 from public.goove_archived_reward_codes where code=next_code)
      and not exists(select 1 from public.reward_claims where selected_code=next_code);
  end loop;
  update public.reward_codes set code=next_code,status='available',created_at=clock_timestamp() where id=r.id;
  update public.purchase_access_codes set status='used',used_at=clock_timestamp() where id=a.id;
  return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',null,'status',c.status,'expires_at',null));
end $$;

-- Keep older API callers compatible, while rejecting reuse through the old RPC.
create or replace function public.goove_reward(
  p_action text,p_hash text,p_reward_id uuid default null,
  p_name text default null,p_reference text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select public.goove_select_reward(p_action,p_hash,p_reward_id,null);
$$;

create or replace function public.goove_fresh_promo_code()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='UPDATE' and new.code=old.code then return new; end if;
  if exists(select 1 from public.goove_archived_reward_codes where code=new.code)
    or exists(select 1 from public.reward_claims where selected_code=new.code) then
    raise exception 'This promo code has already been issued. Generate a fresh code.';
  end if;
  return new;
end $$;
drop trigger if exists goove_fresh_promo_code on public.reward_codes;
create trigger goove_fresh_promo_code before insert or update of code on public.reward_codes
for each row execute function public.goove_fresh_promo_code();

revoke all on function public.goove_select_reward(text,text,uuid,uuid),public.goove_reward(text,text,uuid,text,text),public.goove_fresh_promo_code() from public,anon,authenticated;
grant execute on function public.goove_select_reward(text,text,uuid,uuid),public.goove_reward(text,text,uuid,text,text),public.goove_fresh_promo_code() to service_role;

create or replace function public.goove_lock_claim() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.request_id is distinct from old.request_id or new.purchase_access_code_id<>old.purchase_access_code_id or new.reward_code_id<>old.reward_code_id or new.selected_code<>old.selected_code or new.selected_at<>old.selected_at or new.benefit_name<>old.benefit_name or new.discount_percent<>old.discount_percent then raise exception 'Reward selections are immutable.'; end if;
 if old.customer_name is not null and (new.customer_name is distinct from old.customer_name or new.purchase_reference is distinct from old.purchase_reference) then raise exception 'Completed registrations are immutable.'; end if; return new; end $$;
create or replace function public.goove_replace_handbag_images(p_handbag_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>10 then
    raise exception 'Add between 1 and 10 photos for each handbag.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>2000 or not ((e#>>'{}') like '/images/%' or (e#>>'{}') like 'https://%.supabase.co/storage/v1/object/public/goove-images/%')) then
    raise exception 'Use photos uploaded to the Goove gallery.';
  end if;
  if not exists(select 1 from public.handbags where id=p_handbag_id) then raise exception 'Handbag not found.'; end if;
  delete from public.handbag_images where handbag_id=p_handbag_id;
  insert into public.handbag_images(handbag_id,image_url,display_order) select p_handbag_id,value#>>'{}',ordinality::integer-1 from jsonb_array_elements(p_images) with ordinality as photos(value,ordinality);
end $$;
create or replace function public.goove_replace_gift_images(p_gift_type_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>10 then
    raise exception 'Add between 1 and 10 photos for each gift.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>2000 or not ((e#>>'{}') like '/images/%' or (e#>>'{}') like 'https://%.supabase.co/storage/v1/object/public/goove-images/%')) then
    raise exception 'Use photos uploaded to the Goove gallery.';
  end if;
  if not exists(select 1 from public.gift_types where id=p_gift_type_id) then raise exception 'Gift not found.'; end if;
  delete from public.gift_type_images where gift_type_id=p_gift_type_id;
  insert into public.gift_type_images(gift_type_id,image_url,display_order) select p_gift_type_id,value#>>'{}',ordinality::integer-1 from jsonb_array_elements(p_images) with ordinality as photos(value,ordinality);
end $$;
revoke all on function public.goove_replace_handbag_images(uuid,jsonb),public.goove_replace_gift_images(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.goove_replace_handbag_images(uuid,jsonb),public.goove_replace_gift_images(uuid,jsonb) to service_role;
