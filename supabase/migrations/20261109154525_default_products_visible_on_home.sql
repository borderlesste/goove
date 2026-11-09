-- Switch the old opt-in catalog to opt-out once. Reapplying must not undo
-- exclusions an owner makes after this change.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='handbags'
      and column_name='featured' and column_default='false'
  ) then
    alter table public.handbags alter column featured set default true;
    update public.handbags set featured=true where not featured;
  end if;
end $$;
