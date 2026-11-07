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
   return jsonb_build_object('claim',jsonb_build_object('id',c.id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',c.customer_name,'status',c.status,'expires_at',c.expires_at));
 end if;
 if a.status not in ('active','used') or a.expires_at<=now() then raise exception 'This access code is invalid or expired.'; end if;
 select * into s from public.goove_settings where id=true for share;
 if not s.promotion_enabled or not s.legal_reviewed then raise exception 'Reward registration is not open yet. Please contact our team.'; end if;
 if p_action='verify' then select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (select rc.id,rc.code,rc.status,null::text as benefit from public.reward_codes rc join public.gift_types gt on gt.id=rc.gift_type_id where rc.status='available' and gt.active order by rc.code) x; return jsonb_build_object('codes',result); end if;
 select * into r from public.reward_codes where id=p_reward_id for update;
 if not found or r.status<>'available' then raise exception 'This promo code is no longer available. Please refresh the list.'; end if;
 select * into g from public.gift_types where id=r.gift_type_id for share;
 if not g.active then raise exception 'This promo is unavailable. Please choose another code.'; end if;
 insert into public.reward_claims(purchase_access_code_id,reward_code_id,selected_code,selected_at,benefit_name,discount_percent,purchase_reference) values(a.id,r.id,r.code,now(),g.name,g.discount_percent,a.purchase_reference) returning * into c;
 insert into public.goove_archived_reward_codes(code,gift_type_id,status,created_at,claim_id,selected_at) values(r.code,r.gift_type_id,'used',r.created_at,c.id,c.selected_at);
 loop next_code:='GIFT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); exit when not exists(select 1 from public.reward_codes where code=next_code) and not exists(select 1 from public.goove_archived_reward_codes where code=next_code); end loop;
 update public.reward_codes set code=next_code,status='available',created_at=now() where id=r.id;
 update public.purchase_access_codes set status='used',used_at=coalesce(used_at,now()) where id=a.id;
 return jsonb_build_object('claim',jsonb_build_object('id',c.id,'code',c.selected_code,'selected_at',c.selected_at,'customer_name',null,'status',c.status,'expires_at',null));
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
