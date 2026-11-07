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