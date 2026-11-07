begin;

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

revoke all on function public.goove_auto_create_promo_code() from public,anon,authenticated;
grant execute on function public.goove_auto_create_promo_code() to service_role;

drop trigger if exists goove_auto_create_promo_code on public.gift_types;
create trigger goove_auto_create_promo_code
  after insert or update of active on public.gift_types
  for each row when (new.active)
  execute function public.goove_auto_create_promo_code();

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

commit;
