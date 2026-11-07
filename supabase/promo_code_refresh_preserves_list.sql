begin;

-- Keep the currently displayed reward row stable while refreshing only the
-- promo code text, so customers with an already-loaded list retain the choice.
-- Each archived code needs its own ID because one reward row can be refreshed
-- repeatedly while its live ID remains unchanged.
alter table public.goove_archived_reward_codes
  alter column id set default gen_random_uuid();

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

  -- Match reservation's reward-code-before-benefit lock order.
  select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
  select * into g from public.gift_types where id=p_gift_type_id for update;
  if not found then raise exception 'This promotion is unavailable.'; end if;

  -- Re-read after serializing refreshes on the promotion row.
  select * into r from public.reward_codes where gift_type_id=p_gift_type_id for update;
  if found then
    if r.status not in ('available','disabled') or exists (
      select 1 from public.reward_claims where reward_code_id=r.id
    ) then
      raise exception 'This promo code has already been claimed and cannot be refreshed.';
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

commit;
