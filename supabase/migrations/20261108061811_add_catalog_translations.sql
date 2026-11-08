-- Optional owner-authored copy; existing content and access policies are preserved.
alter table public.handbags add column if not exists translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
alter table public.gift_types add column if not exists translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
alter table public.goove_settings add column if not exists translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
