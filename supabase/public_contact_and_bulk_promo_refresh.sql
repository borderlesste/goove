begin;

alter table public.goove_settings alter column promotion_mode set default 'hidden';
alter table public.goove_settings add column if not exists public_phone text
  check(public_phone is null or public_phone ~ '^\+?[0-9][0-9 ()-]{6,28}$');
alter table public.goove_settings add column if not exists public_email text
  check(public_email is null or public_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.goove_settings add column if not exists social_links jsonb not null default '[]'::jsonb
  check(jsonb_typeof(social_links)='array');

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

commit;
