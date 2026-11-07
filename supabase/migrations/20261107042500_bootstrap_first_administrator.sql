-- One durable bootstrap decision, separate from the public Data API.
create schema if not exists goove_private;
revoke all on schema goove_private from public, anon, authenticated;

create table if not exists goove_private.initial_administrator (
  singleton boolean primary key default true check (singleton),
  user_id uuid unique references auth.users(id) on delete set null,
  initialized_at timestamptz not null default now()
);
alter table goove_private.initial_administrator enable row level security;
revoke all on goove_private.initial_administrator from public, anon, authenticated;

-- Auth's signup role cannot write the owner allowlist directly. This internal
-- trigger has exactly that job; it is not an RPC callable by browser roles.
create or replace function goove_private.bootstrap_first_administrator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or trim(new.email) = ''
     or coalesce(new.is_anonymous, false) or new.deleted_at is not null then
    return new;
  end if;

  -- The singleton primary key arbitrates simultaneous signups atomically.
  insert into goove_private.initial_administrator(singleton, user_id)
    values (true, new.id)
    on conflict (singleton) do nothing;
  if found then
    insert into public.goove_owners(user_id) values (new.id)
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function goove_private.bootstrap_first_administrator()
  from public, anon, authenticated;

drop trigger if exists goove_first_administrator on auth.users;
create trigger goove_first_administrator
  after insert on auth.users
  for each row execute function goove_private.bootstrap_first_administrator();

-- CREATE TRIGGER holds a write-conflicting lock through this transaction, so
-- existing accounts are seeded before a new signup can claim the empty slot.
with first_account as (
  select id from auth.users
  where email is not null and trim(email) <> ''
    and not coalesce(is_anonymous, false) and deleted_at is null
  order by created_at nulls last, id
  limit 1
), initialized as (
  insert into goove_private.initial_administrator(singleton, user_id)
    select true, id from first_account
    on conflict (singleton) do nothing
    returning user_id
)
insert into public.goove_owners(user_id)
  select user_id from initialized
  on conflict (user_id) do nothing;

-- Deleting the first user clears only its FK. The singleton remains closed.
-- Rollback: a forward migration can drop the trigger and revoke a specifically
-- reviewed owner row. Keep the singleton record so setup never reopens silently.
