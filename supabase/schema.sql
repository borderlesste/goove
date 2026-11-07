-- Goove: apply only to its separate project. No existing project objects are replaced.
begin;
create table public.goove_owners (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.handbags (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), description text not null check(length(description)<=500), image_url text not null, price numeric(10,2) check(price is null or price>0), in_stock boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now());
create table public.gift_types (id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100),description text not null check(length(description)<=500),image_url text,active boolean not null default true,discount_percent integer not null default 0 check(discount_percent between 0 and 100));
create table public.purchase_access_codes (id uuid primary key default gen_random_uuid(),code_hash text not null unique check(length(code_hash)=64),purchase_reference text check(length(purchase_reference)<=100),status text not null default 'active' check(status in ('active','used','revoked')),expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
create table public.reward_codes (id uuid primary key default gen_random_uuid(),code text not null unique,gift_type_id uuid not null references public.gift_types(id),status text not null default 'available' check(status in ('available','reserved','claimed','disabled')),created_at timestamptz not null default now());
create table public.reward_claims (id uuid primary key default gen_random_uuid(),purchase_access_code_id uuid not null unique references public.purchase_access_codes(id),reward_code_id uuid not null references public.reward_codes(id),selected_code text not null unique,selected_at timestamptz not null default now(),customer_name text check(customer_name is null or length(trim(customer_name)) between 2 and 100),purchase_reference text check(length(purchase_reference)<=100),status text not null default 'pending_verification' check(status in ('pending_verification','verified','fulfilled','expired')),benefit_name text not null,discount_percent integer not null,created_at timestamptz not null default now(),registered_at timestamptz,activated_at timestamptz,expires_at timestamptz);
create table public.goove_settings (id boolean primary key default true check(id),business_name text not null default 'Goove',whatsapp_number text not null default '17176554737' check(whatsapp_number ~ '^[0-9]{8,15}$'),public_phone text check(public_phone is null or public_phone ~ '^\+?[0-9][0-9 ()-]{6,28}$'),public_email text check(public_email is null or public_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),social_links jsonb not null default '[]'::jsonb check(jsonb_typeof(social_links)='array'),hero_heading text not null default E'Everyday,\nexceptionally.',hero_description text not null default 'Beautiful handbags for a more considered life — and exclusive rewards for the journey with you.',hero_cta_text text not null default 'VIEW GIFTS & REWARDS',hero_image_url text not null default '/images/hero.webp',promo_banner_text text not null default 'Buy any bag and unlock a special Goove promo.',promotion_mode text not null default 'hidden' check(promotion_mode in ('hidden','transparent')),promotion_enabled boolean not null default false,legal_reviewed boolean not null default false,check(not promotion_enabled or legal_reviewed));
insert into public.goove_settings(id) values(true);
create table public.goove_rate_limits (key text primary key, window_start timestamptz not null,attempts integer not null);
create index reward_codes_availability on public.reward_codes(status,gift_type_id);
create index reward_claims_status on public.reward_claims(status,expires_at);
create index reward_codes_gift on public.reward_codes(gift_type_id);
-- No browser role can read hashes, customer records, assignments, or edit any table.
do $$ declare t text; begin foreach t in array array['goove_owners','handbags','gift_types','purchase_access_codes','reward_codes','reward_claims','goove_settings','goove_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop; end $$;

create function public.goove_rate_limit(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer; begin
 insert into public.goove_rate_limits as r(key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set attempts=case when r.window_start<now()-interval '5 minutes' then 1 else r.attempts+1 end,
 window_start=case when r.window_start<now()-interval '5 minutes' then now() else r.window_start end returning attempts into n;
 delete from public.goove_rate_limits where window_start<now()-interval '1 day';
 return n<=40; end $$;

-- A database transaction serializes on the purchase row, then the chosen reward row.
-- Unique constraints are the final guard against competing claims across devices.
create function public.goove_reward(p_action text,p_hash text,p_reward_id uuid default null,p_name text default null,p_reference text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.purchase_access_codes%rowtype; c public.reward_claims%rowtype; r public.reward_codes%rowtype; g public.gift_types%rowtype; s public.goove_settings%rowtype; result jsonb;
begin
 if p_action not in ('verify','reserve','register') then raise exception 'Invalid request.'; end if;
 select * into a from public.purchase_access_codes where code_hash=p_hash for update;
 if not found or a.status='revoked' then raise exception 'This access code is invalid or unavailable.'; end if;
 select * into c from public.reward_claims where purchase_access_code_id=a.id for update;
 if found then
   -- Existing selections remain recoverable after access expiry or promotion closure.
   if p_action='reserve' and p_reward_id is distinct from c.reward_code_id then raise exception 'Your selection is already locked. Re-enter your access code to continue.'; end if;
   if p_action='register' and c.customer_name is null then
     if length(trim(coalesce(p_name,''))) not between 2 and 100 or length(coalesce(p_reference,''))>100 then raise exception 'Enter a full name between 2 and 100 characters.'; end if;
     update public.reward_claims set customer_name=trim(p_name),purchase_reference=coalesce(nullif(trim(p_reference),''),a.purchase_reference),registered_at=now() where id=c.id returning * into c;
     update public.reward_codes set status='claimed' where id=c.reward_code_id;
   end if;
   if c.status='verified' and c.expires_at<=now() then update public.reward_claims set status='expired' where id=c.id returning * into c; end if;
   return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code','GIFT-••••••••','selected_at',c.selected_at,'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
 end if;
 if a.status<>'active' or a.expires_at<=now() then raise exception 'This access code is invalid or expired.'; end if;
 select * into s from public.goove_settings where id=true for share;
 if not s.promotion_enabled or not s.legal_reviewed then raise exception 'Reward registration is not open yet. Please contact our team.'; end if;
 if p_action='register' then raise exception 'Please select a reward code first.'; end if;
 if p_action='verify' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (select rc.id,rc.code,rc.status,null::text as benefit from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id where rc.status='available' and gt.active order by rc.code) x;
   return jsonb_build_object('codes',result);
 end if;
 select * into r from public.reward_codes where id=p_reward_id for update;
 if not found or r.status<>'available' then raise exception 'This reward code is no longer available. Please verify your access code again.'; end if;
 select * into g from public.gift_types where id=r.gift_type_id for share;
 if not g.active then raise exception 'This reward is unavailable. Please choose another code.'; end if;
 insert into public.reward_claims(purchase_access_code_id,reward_code_id,selected_code,benefit_name,discount_percent,purchase_reference) values(a.id,r.id,r.code,g.name,g.discount_percent,a.purchase_reference) returning * into c;
 insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at) values(r.code,r.gift_type_id,'used',r.created_at,c.id,now());
 update public.reward_codes set code='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),status='available',created_at=now() where id=r.id;
 update public.purchase_access_codes set status='used',used_at=now() where id=a.id;
 return jsonb_build_object('claim',jsonb_build_object('id',c.id,'code',r.code,'selected_at',c.selected_at,'customer_name',null,'status',c.status,'expires_at',null));
end $$;

create function public.goove_set_claim_status(p_id uuid,p_status text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.reward_claims%rowtype; begin
 select * into c from public.reward_claims where id=p_id for update;
 if not found or c.customer_name is null then raise exception 'Complete registration is required.'; end if;
 if c.status=p_status then return to_jsonb(c); end if;
 if p_status not in ('verified','fulfilled','expired') or c.status in ('expired','fulfilled') then raise exception 'This status transition is not allowed.'; end if;
 if p_status='verified' and c.status<>'pending_verification' then raise exception 'Only a pending claim can be verified.'; end if;
 if p_status='fulfilled' and (c.status<>'verified' or c.expires_at<=now()) then raise exception 'Only a verified, unexpired claim can be fulfilled.'; end if;
 update public.reward_claims set status=p_status,activated_at=case when p_status='verified' then now() else activated_at end,expires_at=case when p_status='verified' and discount_percent>0 then now()+interval '15 days' else expires_at end where id=p_id returning * into c;
 return to_jsonb(c); end $$;

create function public.goove_lock_claim() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.purchase_access_code_id<>old.purchase_access_code_id or new.reward_code_id<>old.reward_code_id or new.benefit_name<>old.benefit_name or new.discount_percent<>old.discount_percent then raise exception 'Reward selections are immutable.'; end if;
 if old.customer_name is not null and (new.customer_name is distinct from old.customer_name or new.purchase_reference is distinct from old.purchase_reference) then raise exception 'Completed registrations are immutable.'; end if;
 return new; end $$;
create trigger lock_reward_claim before update on public.reward_claims for each row execute function public.goove_lock_claim();
revoke all on function public.goove_rate_limit(text),public.goove_reward(text,text,uuid,text,text),public.goove_set_claim_status(uuid,text),public.goove_lock_claim() from public,anon,authenticated;
grant execute on function public.goove_rate_limit(text),public.goove_reward(text,text,uuid,text,text),public.goove_set_claim_status(uuid,text),public.goove_lock_claim() to service_role;
create table public.goove_owner_invitations(email text primary key);
alter table public.goove_owner_invitations enable row level security;
revoke all on public.goove_owner_invitations from public,anon,authenticated;
grant all on public.goove_owner_invitations to service_role;
-- One current access code at a time; each code can authorize only one promo selection.
create or replace function public.goove_refresh_access(p_hash text)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid access code.'; end if;
  perform 1 from public.goove_settings where id=true for update;
  update public.purchase_access_codes set status='revoked'
    where status='active' and used_at is null;
  insert into public.purchase_access_codes(code_hash,purchase_reference,expires_at)
    values(p_hash,'Customer promo access',now()+interval '30 days');
end;
$$;

create or replace function public.goove_reward(
  p_action text,p_hash text,p_reward_id uuid default null,p_name text default null,p_reference text default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  a public.purchase_access_codes%rowtype;
  c public.reward_claims%rowtype;
  r public.reward_codes%rowtype;
  g public.gift_types%rowtype;
  s public.goove_settings%rowtype;
  result jsonb;
begin
  if p_action not in ('verify','reserve') then raise exception 'Invalid request.'; end if;
  select * into a from public.purchase_access_codes where code_hash=p_hash for update;
  if not found or a.status='revoked' then raise exception 'This access code is invalid or unavailable.'; end if;
  select * into c from public.reward_claims where purchase_access_code_id=a.id for update;
  if found then
    if p_action='verify' then
      return jsonb_build_object('claim',jsonb_build_object(
        'id',c.id,'code',(select code from public.reward_codes where id=c.reward_code_id),
        'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
    end if;
    if p_action='reserve' and p_reward_id is distinct from c.reward_code_id then
      raise exception 'Your selection is already locked. Re-enter your access code to continue.';
    end if;
    if c.status='verified' and c.expires_at<=now() then
      update public.reward_claims set status='expired' where id=c.id returning * into c;
    end if;
    return jsonb_build_object('claim',jsonb_build_object(
      'id',c.id,'code',(select code from public.reward_codes where id=c.reward_code_id),
      'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
  end if;
  if a.status not in ('active','used') or a.expires_at<=now() then
    raise exception 'This access code is invalid or expired.';
  end if;
  select * into s from public.goove_settings where id=true for share;
  if not s.promotion_enabled or not s.legal_reviewed then
    raise exception 'Reward registration is not open yet. Please contact our team.';
  end if;
  if p_action='verify' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result
      from (select rc.id,rc.code,rc.status,
        null::text as benefit
        from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id
        where rc.status in ('available','reserved') and gt.active order by rc.code) x;
    if jsonb_array_length(result)>0 and a.status='active' then
      update public.purchase_access_codes set status='used',used_at=now() where id=a.id;
    end if;
    return jsonb_build_object('codes',result);
  end if;
  select * into r from public.reward_codes where id=p_reward_id for update;
  if not found or r.status<>'available' then
    raise exception 'This promo code is no longer available. Please contact our team.';
  end if;
  select * into g from public.gift_types where id=r.gift_type_id for share;
  if not g.active then raise exception 'This promo is unavailable. Please choose another code.'; end if;
  insert into public.reward_claims(purchase_access_code_id,reward_code_id,benefit_name,discount_percent,purchase_reference)
    values(a.id,r.id,g.name,g.discount_percent,a.purchase_reference) returning * into c;
  update public.reward_codes set status='reserved' where id=r.id;
  update public.purchase_access_codes set status='used',used_at=coalesce(used_at,now()) where id=a.id;
  return jsonb_build_object('claim',jsonb_build_object(
    'id',c.id,'code',r.code,'customer_name',null,'status',c.status,'expires_at',null));
end;
$$;

create or replace function public.goove_set_claim_status(p_id uuid,p_status text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare c public.reward_claims%rowtype;
begin
  select * into c from public.reward_claims where id=p_id for update;
  if not found then raise exception 'Reward claim not found.'; end if;
  if c.status=p_status then return to_jsonb(c); end if;
  if p_status not in ('verified','fulfilled','expired') or c.status in ('expired','fulfilled') then
    raise exception 'This status transition is not allowed.';
  end if;
  if p_status='verified' and c.status<>'pending_verification' then
    raise exception 'Only a pending claim can be verified.';
  end if;
  if p_status='fulfilled' and (c.status<>'verified' or c.expires_at<=now()) then
    raise exception 'Only a verified, unexpired claim can be fulfilled.';
  end if;
  update public.reward_claims set status=p_status,
    activated_at=case when p_status='verified' then now() else activated_at end,
    expires_at=case when p_status='verified' and discount_percent>0 then now()+interval '15 days' else expires_at end
    where id=p_id returning * into c;
  return to_jsonb(c);
end;
$$;

revoke all on function public.goove_refresh_access(text),public.goove_reward(text,text,uuid,text,text),public.goove_set_claim_status(uuid,text)
  from public,anon,authenticated;
grant execute on function public.goove_refresh_access(text),public.goove_reward(text,text,uuid,text,text),public.goove_set_claim_status(uuid,text)
  to service_role;



-- One active promo code per promotion.
-- Keep an auditable copy of duplicate, unused codes while leaving only one code
-- row for each promotion in the customer-facing inventory.
create table if not exists public.goove_archived_reward_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  gift_type_id uuid not null,
  status text not null,
  created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  claim_id uuid references public.reward_claims(id),
  selected_at timestamptz
);
alter table public.goove_archived_reward_codes alter column id set default gen_random_uuid();
alter table public.goove_archived_reward_codes enable row level security;
revoke all on public.goove_archived_reward_codes from public,anon,authenticated;
grant all on public.goove_archived_reward_codes to service_role;

with ranked as (
  select rc.id,
    row_number() over (
      partition by rc.gift_type_id
      order by case rc.status when 'available' then 0 when 'reserved' then 1 when 'claimed' then 2 else 3 end,
               rc.created_at,rc.id
    ) as position
  from public.reward_codes rc
)
insert into public.goove_archived_reward_codes(id,code,gift_type_id,status,created_at)
select rc.id,rc.code,rc.gift_type_id,rc.status,rc.created_at
from ranked r join public.reward_codes rc on rc.id=r.id
where r.position>1
  and not exists (select 1 from public.reward_claims c where c.reward_code_id=rc.id)
on conflict (id) do nothing;

delete from public.reward_codes rc
using public.goove_archived_reward_codes archived
where rc.id=archived.id
  and not exists (select 1 from public.reward_claims c where c.reward_code_id=rc.id);

create unique index if not exists reward_codes_one_per_promotion
  on public.reward_codes(gift_type_id);

-- Every active promotion gets exactly one customer-visible promo code.
create or replace function public.goove_auto_create_promo_code()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  next_code text;
begin
  if not new.active or exists (
    select 1 from public.reward_codes where gift_type_id=new.id
  ) then
    return new;
  end if;
  loop
    next_code := 'GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists (select 1 from public.reward_codes where code=next_code)
      and not exists (select 1 from public.goove_archived_reward_codes where code=next_code);
  end loop;
  insert into public.reward_codes(code,gift_type_id)
    values(next_code,new.id)
    on conflict (gift_type_id) do nothing;
  return new;
end;
$$;

drop trigger if exists goove_auto_create_promo_code on public.gift_types;
create trigger goove_auto_create_promo_code
  after insert or update of active on public.gift_types
  for each row when (new.active)
  execute function public.goove_auto_create_promo_code();
revoke all on function public.goove_auto_create_promo_code() from public,anon,authenticated;
grant execute on function public.goove_auto_create_promo_code() to service_role;

do $$
declare
  g record;
  next_code text;
begin
  for g in
    select gt.id from public.gift_types gt
    where gt.active and not exists (
      select 1 from public.reward_codes rc where rc.gift_type_id=gt.id
    )
  loop
    loop
      next_code := 'GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists (select 1 from public.reward_codes where code=next_code)
        and not exists (select 1 from public.goove_archived_reward_codes where code=next_code);
    end loop;
    insert into public.reward_codes(code,gift_type_id)
      values(next_code,g.id)
      on conflict (gift_type_id) do nothing;
  end loop;
end;
$$;

-- Replace the single unclaimed code for one promotion, retaining an audit copy.
create or replace function public.goove_refresh_promo_code(p_gift_type_id uuid,p_code text)
returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  g public.gift_types%rowtype;
  r public.reward_codes%rowtype;
begin
  if p_code !~ '^GIFT-[A-F0-9]{8}$' then raise exception 'Invalid promo code.'; end if;
  select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
  select * into g from public.gift_types where id=p_gift_type_id for update;
  if not found then raise exception 'This promotion is unavailable.'; end if;
  select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
  if found then
    if r.status not in ('available','disabled') then
      raise exception 'Only an available promo code can be refreshed.';
    end if;
    insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at)
      values(r.code,r.gift_type_id,r.status,r.created_at);
    update public.reward_codes
      set code=p_code,status='available',created_at=now()
      where id=r.id;
    return p_code;
  end if;
  insert into public.reward_codes(code,gift_type_id) values(p_code,p_gift_type_id);
  return p_code;
end;
$$;

revoke all on function public.goove_refresh_promo_code(uuid,text) from public,anon,authenticated;
grant execute on function public.goove_refresh_promo_code(uuid,text) to service_role;

create or replace function public.goove_refresh_available_promo_codes()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.reward_codes%rowtype;
  next_code text;
  refreshed text[] := array[]::text[];
begin
  for r in
    select rc.* from public.reward_codes rc
    where rc.status='available'
      and not exists (select 1 from public.reward_claims c where c.reward_code_id=rc.id)
    order by rc.gift_type_id
    for update
  loop
    loop
      next_code := 'GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists (select 1 from public.reward_codes where code=next_code)
        and not exists (select 1 from public.goove_archived_reward_codes where code=next_code);
    end loop;
    refreshed := array_append(refreshed,public.goove_refresh_promo_code(r.gift_type_id,next_code));
  end loop;
  return jsonb_build_object('count',cardinality(refreshed),'codes',to_jsonb(refreshed));
end;
$$;
revoke all on function public.goove_refresh_available_promo_codes() from public,anon,authenticated;
grant execute on function public.goove_refresh_available_promo_codes() to service_role;

alter table public.goove_settings add column if not exists public_phone text
  check(public_phone is null or public_phone ~ '^\+?[0-9][0-9 ()-]{6,28}$');
alter table public.goove_settings add column if not exists public_email text
  check(public_email is null or public_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.goove_settings add column if not exists social_links jsonb not null default '[]'::jsonb
  check(jsonb_typeof(social_links)='array');

-- Ordered galleries for each product and gift card.
create table if not exists public.handbag_images (
  id uuid primary key default gen_random_uuid(),
  handbag_id uuid not null references public.handbags(id) on delete cascade,
  image_url text not null check(length(image_url)<=2000),
  display_order integer not null check(display_order>=0),
  unique(handbag_id,display_order)
);
create table if not exists public.gift_type_images (
  id uuid primary key default gen_random_uuid(),
  gift_type_id uuid not null references public.gift_types(id) on delete cascade,
  image_url text not null check(length(image_url)<=2000),
  display_order integer not null check(display_order>=0),
  unique(gift_type_id,display_order)
);
do $$ declare t text; begin foreach t in array array['handbag_images','gift_type_images'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
end loop; end $$;

create or replace function public.goove_replace_handbag_images(p_handbag_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>3 then
    raise exception 'Add between 1 and 3 photos for each handbag.';
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
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>3 then
    raise exception 'Add between 1 and 3 photos for each gift.';
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

commit;

begin;
alter table public.reward_claims add column if not exists selected_code text;
alter table public.reward_claims add column if not exists selected_at timestamptz;
update public.reward_claims c set selected_code=rc.code, selected_at=coalesce(c.created_at,now()) from public.reward_codes rc where rc.id=c.reward_code_id and (c.selected_code is null or c.selected_at is null);
do $$ declare con record; begin for con in select conname from pg_constraint where conrelid='public.reward_claims'::regclass and contype='u' and pg_get_constraintdef(oid) like '%reward_code_id%' loop execute format('alter table public.reward_claims drop constraint %I',con.conname); end loop; end $$;
alter table public.reward_claims alter column selected_code set not null;
alter table public.reward_claims alter column selected_at set not null;
create unique index if not exists reward_claims_selected_code_unique on public.reward_claims(selected_code);
alter table public.goove_archived_reward_codes add column if not exists claim_id uuid references public.reward_claims(id);
alter table public.goove_archived_reward_codes add column if not exists selected_at timestamptz;
update public.goove_archived_reward_codes a set claim_id=c.id, selected_at=c.selected_at from public.reward_claims c where c.selected_code=a.code and a.claim_id is null;
-- Previously selected codes are copied into permanent history and their stable
-- promotion rows receive fresh, available codes.
do $$ declare r record; next_code text; begin
 for r in select rc.id,rc.code,rc.gift_type_id,rc.created_at,c.id claim_id,c.selected_at from public.reward_codes rc join public.reward_claims c on c.reward_code_id=rc.id where rc.status in ('reserved','claimed') order by rc.id loop
   insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at) values(r.code,r.gift_type_id,'used',r.created_at,r.claim_id,r.selected_at) on conflict (code) do update set claim_id=excluded.claim_id,selected_at=excluded.selected_at;
   loop next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); exit when not exists(select 1 from public.reward_codes where code=next_code) and not exists(select 1 from public.goove_archived_reward_codes where code=next_code); end loop;
   update public.reward_codes set code=next_code,status='available',created_at=now() where id=r.id;
 end loop;
end $$;
create or replace function public.goove_reward(p_action text,p_hash text,p_reward_id uuid default null,p_name text default null,p_reference text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.purchase_access_codes%rowtype; c public.reward_claims%rowtype; r public.reward_codes%rowtype; g public.gift_types%rowtype; s public.goove_settings%rowtype; result jsonb; next_code text; begin
 if p_action not in ('verify','reserve') then raise exception 'Invalid request.'; end if;
 select * into a from public.purchase_access_codes where code_hash=p_hash for update;
 if not found or a.status='revoked' then raise exception 'This access code is invalid or unavailable.'; end if;
 select * into c from public.reward_claims where purchase_access_code_id=a.id for update;
 if found then
   if p_action='reserve' and p_reward_id is distinct from c.reward_code_id then raise exception 'Your selection is already locked. Re-enter your access code to continue.'; end if;
   if c.status='verified' and c.expires_at<=now() then update public.reward_claims set status='expired' where id=c.id returning * into c; end if;
   return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code','GIFT-••••••••','selected_at',c.selected_at,'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
 end if;
 if a.status not in ('active','used') or a.expires_at<=now() then raise exception 'This access code is invalid or expired.'; end if;
 select * into s from public.goove_settings where id=true for share;
 if not s.promotion_enabled or not s.legal_reviewed then raise exception 'Reward registration is not open yet. Please contact our team.'; end if;
 if p_action='verify' then select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (select rc.id,'GIFT-••••••••'::text as code,rc.status,null::text as benefit from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id where rc.status='available' and gt.active order by random()) x; return jsonb_build_object('codes',result); end if;
 select * into r from public.reward_codes where id=p_reward_id for update;
 if not found or r.status<>'available' then raise exception 'This promo code is no longer available. Please refresh the list.'; end if;
 select * into g from public.gift_types where id=r.gift_type_id for share;
 if not g.active then raise exception 'This promo is unavailable. Please choose another code.'; end if;
 insert into public.reward_claims(purchase_access_code_id,reward_code_id,selected_code,selected_at,benefit_name,discount_percent,purchase_reference) values(a.id,r.id,r.code,now(),g.name,g.discount_percent,a.purchase_reference) returning * into c;
 insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at) values(r.code,r.gift_type_id,'used',r.created_at,c.id,c.selected_at);
 loop next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); exit when not exists(select 1 from public.reward_codes where code=next_code) and not exists(select 1 from public.goove_archived_reward_codes where code=next_code); end loop;
 update public.reward_codes set code=next_code,status='available',created_at=now() where id=r.id;
 update public.purchase_access_codes set status='used',used_at=coalesce(used_at,now()) where id=a.id;
 return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',null,'status',c.status,'expires_at',null));
end $$;
create or replace function public.goove_lock_claim() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.purchase_access_code_id<>old.purchase_access_code_id or new.reward_code_id<>old.reward_code_id or new.selected_code<>old.selected_code or new.selected_at<>old.selected_at or new.benefit_name<>old.benefit_name or new.discount_percent<>old.discount_percent then raise exception 'Reward selections are immutable.'; end if;
 if old.customer_name is not null and (new.customer_name is distinct from old.customer_name or new.purchase_reference is distinct from old.purchase_reference) then raise exception 'Completed registrations are immutable.'; end if; return new; end $$;
create or replace function public.goove_refresh_promo_code(p_gift_type_id uuid,p_code text) returns text language plpgsql security invoker set search_path='' as $$ declare g public.gift_types%rowtype; r public.reward_codes%rowtype; begin
 if p_code !~ '^GIFT-[A-F0-9]{8}$' then raise exception 'Invalid promo code.'; end if;
 select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
 select * into g from public.gift_types where id=p_gift_type_id for update;
 if not found then raise exception 'This promotion is unavailable.'; end if;
 select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
 if found then if r.status not in ('available','disabled') then raise exception 'Only an available promo code can be refreshed.'; end if;
 insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at) values(r.code,r.gift_type_id,r.status,r.created_at);
 update public.reward_codes set code=p_code,status='available',created_at=now() where id=r.id; return p_code; end if;
 insert into public.reward_codes(code,gift_type_id) values(p_code,p_gift_type_id); return p_code; end $$;
create or replace function public.goove_refresh_available_promo_codes() returns jsonb language plpgsql security invoker set search_path='' as $$ declare r public.reward_codes%rowtype; next_code text; refreshed text[]:=array[]::text[]; begin
 for r in select rc.* from public.reward_codes rc where rc.status='available' order by rc.gift_type_id for update loop
  loop next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); exit when not exists(select 1 from public.reward_codes where code=next_code) and not exists(select 1 from public.goove_archived_reward_codes where code=next_code); end loop;
  refreshed:=array_append(refreshed,public.goove_refresh_promo_code(r.gift_type_id,next_code));
 end loop; return jsonb_build_object('count',cardinality(refreshed),'codes',to_jsonb(refreshed)); end $$;
revoke all on function public.goove_reward(text,text,uuid,text,text),public.goove_lock_claim(),public.goove_refresh_promo_code(uuid,text),public.goove_refresh_available_promo_codes() from public,anon,authenticated;
grant execute on function public.goove_reward(text,text,uuid,text,text),public.goove_lock_claim(),public.goove_refresh_promo_code(uuid,text),public.goove_refresh_available_promo_codes() to service_role;
commit;
alter table public.handbags add column if not exists price numeric(10,2) check(price is null or price>0);

create or replace function public.goove_reward(p_action text,p_hash text,p_reward_id uuid default null,p_name text default null,p_reference text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.purchase_access_codes%rowtype; c public.reward_claims%rowtype; r public.reward_codes%rowtype; g public.gift_types%rowtype; s public.goove_settings%rowtype; result jsonb; next_code text;
begin
 if p_action not in ('verify','reserve') then raise exception 'Invalid request.'; end if;
 select * into a from public.purchase_access_codes where code_hash=p_hash for update;
 if not found or a.status='revoked' then raise exception 'This access code is invalid or unavailable.'; end if;
 select * into c from public.reward_claims where purchase_access_code_id=a.id for update;
 if found then
   if p_action='reserve' and p_reward_id is distinct from c.reward_code_id then raise exception 'Your selection is already locked. Re-enter your access code to continue.'; end if;
   if c.status='verified' and c.expires_at<=now() then update public.reward_claims set status='expired' where id=c.id returning * into c; end if;
   return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code',case when p_action='reserve' then c.selected_code else 'GIFT-••••••••' end,'selected_at',c.selected_at,'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
 end if;
 if a.status not in ('active','used') or a.expires_at<=now() then raise exception 'This access code is invalid or expired.'; end if;
 select * into s from public.goove_settings where id=true for share;
 if not s.promotion_enabled or not s.legal_reviewed then raise exception 'Reward registration is not open yet. Please contact our team.'; end if;
 if p_action='verify' then
   select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (select rc.id,'GIFT-••••••••'::text as code,rc.status,null::text as benefit from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id where rc.status='available' and gt.active order by random()) x;
   return jsonb_build_object('codes',result);
 end if;
 select * into r from public.reward_codes where id=p_reward_id for update;
 if not found or r.status<>'available' then raise exception 'This promo code is no longer available. Please refresh the list.'; end if;
 select * into g from public.gift_types where id=r.gift_type_id for share;
 if not g.active then raise exception 'This promo is unavailable. Please choose another code.'; end if;
 insert into public.reward_claims(purchase_access_code_id,reward_code_id,selected_code,selected_at,benefit_name,discount_percent,purchase_reference) values(a.id,r.id,r.code,now(),g.name,g.discount_percent,a.purchase_reference) returning * into c;
 insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at) values(r.code,r.gift_type_id,'used',r.created_at,c.id,c.selected_at);
 loop next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); exit when not exists(select 1 from public.reward_codes where code=next_code) and not exists(select 1 from public.goove_archived_reward_codes where code=next_code); end loop;
 update public.reward_codes set code=next_code,status='available',created_at=now() where id=r.id;
 update public.purchase_access_codes set status='used',used_at=coalesce(used_at,now()) where id=a.id;
 return jsonb_build_object('claim',jsonb_build_object('id',c.id,'reward_code_id',c.reward_code_id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',null,'status',c.status,'expires_at',null));
end $$;
revoke all on function public.goove_reward(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.goove_reward(text,text,uuid,text,text) to service_role;
