-- This internal event trigger runs automatically on DDL. Browser roles never
-- need EXECUTE; revoking it does not disable the event trigger itself.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
