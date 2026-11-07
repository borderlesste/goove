alter table public.handbags
  add column if not exists specifications text not null default ''
  check (char_length(specifications) <= 1500);

alter table public.goove_settings
  alter column hero_heading set default 'Elevate Your Elegance',
  alter column hero_description set default 'Luxury Women''s Handbags with Exclusive Matching Gift',
  alter column hero_cta_text set default 'SHOP THE COLLECTION';

update public.goove_settings set
  hero_heading = 'Elevate Your Elegance',
  hero_description = 'Luxury Women''s Handbags with Exclusive Matching Gift',
  hero_cta_text = 'SHOP THE COLLECTION'
where id = true;
