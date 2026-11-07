-- Refreshing the shared access code revokes only the current unused code.
-- A customer who already unlocked or selected a promo keeps using their code.
create or replace function public.goove_refresh_access(p_hash text)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid access code.'; end if;
  perform 1 from public.goove_settings where id=true for update;
  update public.purchase_access_codes set status='revoked'
    where status='active' and used_at is null;
  insert into public.purchase_access_codes(code_hash,purchase_reference,expires_at)
    values(p_hash,'Customer promo access',now()+interval '30 days');
end;
$$;

revoke all on function public.goove_refresh_access(text) from public,anon,authenticated;
grant execute on function public.goove_refresh_access(text) to service_role;
