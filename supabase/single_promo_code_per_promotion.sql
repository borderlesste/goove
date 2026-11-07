begin;

-- Keep an auditable copy of duplicate, unused codes while leaving only one code
-- row for each promotion in the customer-facing inventory.
create table if not exists public.goove_archived_reward_codes (
  id uuid primary key,
  code text not null unique,
  gift_type_id uuid not null,
  status text not null,
  created_at timestamptz not null,
  archived_at timestamptz not null default now()
);
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

commit;
