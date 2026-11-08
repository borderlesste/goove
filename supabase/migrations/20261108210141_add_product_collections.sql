-- Keep product IDs, galleries and existing order links intact.
alter table public.handbags add column if not exists category text not null default 'handbag' check(category in ('handbag','watch'));
alter table public.handbags add column if not exists audience text not null default 'women' check(audience in ('women','men'));
-- Seed a small initial selection only when the feature control is first added.
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='handbags' and column_name='featured') then
    alter table public.handbags add column featured boolean not null default false;
    update public.handbags set featured=true where id in (select id from public.handbags order by display_order,created_at,id limit 6);
  end if;
end $$;
update public.goove_settings set hero_description = 'Women’s watches and handbags, with select men’s watches.'
where hero_description = 'Luxury Women''s Handbags with Exclusive Matching Gift';

update public.goove_settings set promo_banner_text = 'Discover watches, handbags & exclusive rewards' where promo_banner_text in ('Buy one bag and get your gift','Buy any bag and unlock a special Goove promo.');
