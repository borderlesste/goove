-- Add ordered, owner-managed photos to each handbag.
begin;
create table public.handbag_images (
  id uuid primary key default gen_random_uuid(),
  handbag_id uuid not null references public.handbags(id) on delete cascade,
  image_url text not null check (length(image_url) <= 2000),
  display_order integer not null check (display_order >= 0),
  unique (handbag_id, display_order)
);
alter table public.handbag_images enable row level security;
revoke all on public.handbag_images from public, anon, authenticated;
grant all on public.handbag_images to service_role;

insert into public.handbag_images(handbag_id,image_url,display_order)
select id,image_url,0 from public.handbags;

create function public.goove_replace_handbag_images(p_handbag_id uuid,p_images jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_images is null or jsonb_typeof(p_images)<>'array'
     or jsonb_array_length(p_images)<3 or jsonb_array_length(p_images)>12 then
    raise exception 'Add between 3 and 12 photos for each handbag.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images) e
    where jsonb_typeof(e)<>'string' or length(e#>>'{}')>2000
      or not ((e#>>'{}') like '/images/%'
        or (e#>>'{}') like 'https://%.supabase.co/storage/v1/object/public/goove-images/%')) then
    raise exception 'Use photos uploaded to the Goove gallery.';
  end if;
  if not exists(select 1 from public.handbags where id=p_handbag_id) then
    raise exception 'Handbag not found.';
  end if;
  delete from public.handbag_images where handbag_id=p_handbag_id;
  insert into public.handbag_images(handbag_id,image_url,display_order)
    select p_handbag_id,value#>>'{}',ordinality::integer-1
    from jsonb_array_elements(p_images) with ordinality as photos(value,ordinality);
end $$;
revoke all on function public.goove_replace_handbag_images(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.goove_replace_handbag_images(uuid,jsonb) to service_role;
commit;
