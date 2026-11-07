alter table public.goove_settings
  add column if not exists hero_heading text not null default E'Everyday,\nexceptionally.',
  add column if not exists hero_description text not null default 'Beautiful handbags for a more considered life — and exclusive rewards for the journey with you.',
  add column if not exists hero_cta_text text not null default 'VIEW GIFTS & REWARDS',
  add column if not exists hero_image_url text not null default '/images/hero.webp',
  add column if not exists promo_banner_text text not null default 'Buy any bag and unlock a special Goove promo.';
