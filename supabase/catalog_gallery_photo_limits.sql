-- Owner-managed, ordered galleries: each handbag and gift supports 1–3 photos.
begin;

-- Keep existing gallery rows intact; owners can curate them down to the new
-- 1–3 photo limit when they edit an item.

create table if not exists public.gift_type_images (
  id uuid primary key default gen_random_uuid(),
  gift_type_id uuid not null references public.gift_types(id) on delete cascade,
  image_url text not null check(length(image_url)<=2000),
  display_order integer not null check(display_order>=0),
  unique(gift_type_id,display_order)
);
alter table public.gift_type_images enable row level security;
revoke all on public.gift_type_images from public,anon,authenticated;
grant all on public.gift_type_images to service_role;

insert into public.gift_type_images(gift_type_id,image_url,display_order)
select id,image_url,0 from public.gift_types where image_url is not null
on conflict(gift_type_id,display_order) do nothing;

create or replace function public.goove_replace_handbag_images(p_handbag_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>3 then
    raise exception 'Add between 1 and 3 photos for each handbag.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>2000 or not ((e#>>'{}') like '/images/%' or (e#>>'{}') like 'https://%.supabase.co/storage/v1/object/public/goove-images/%')) then
    raise exception 'Use photos uploaded to the Goove gallery.';
  end if;
  if not exists(select 1 from public.handbags where id=p_handbag_id) then raise exception 'Handbag not found.'; end if;
  delete from public.handbag_images where handbag_id=p_handbag_id;
  insert into public.handbag_images(handbag_id,image_url,display_order)
    select p_handbag_id,value#>>'{}',ordinality::integer-1 from jsonb_array_elements(p_images) with ordinality as photos(value,ordinality);
end $$;

create or replace function public.goove_replace_gift_images(p_gift_type_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)<1 or jsonb_array_length(p_images)>3 then
    raise exception 'Add between 1 and 3 photos for each gift.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>2000 or not ((e#>>'{}') like '/images/%' or (e#>>'{}') like 'https://%.supabase.co/storage/v1/object/public/goove-images/%')) then
    raise exception 'Use photos uploaded to the Goove gallery.';
  end if;
  if not exists(select 1 from public.gift_types where id=p_gift_type_id) then raise exception 'Gift not found.'; end if;
  delete from public.gift_type_images where gift_type_id=p_gift_type_id;
  insert into public.gift_type_images(gift_type_id,image_url,display_order)
    select p_gift_type_id,value#>>'{}',ordinality::integer-1 from jsonb_array_elements(p_images) with ordinality as photos(value,ordinality);
end $$;

revoke all on function public.goove_replace_handbag_images(uuid,jsonb),public.goove_replace_gift_images(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.goove_replace_handbag_images(uuid,jsonb),public.goove_replace_gift_images(uuid,jsonb) to service_role;
commit;
