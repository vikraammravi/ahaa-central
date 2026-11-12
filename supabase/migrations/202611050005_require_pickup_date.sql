-- Apply after all clients use submit_pickup_with_date. The legacy operation is
-- retained for the dated wrapper, but is no longer exposed directly to clients.
begin;
revoke execute on function public.submit_pickup(uuid,jsonb,text,boolean) from public, anon, authenticated;
grant execute on function public.submit_pickup(uuid,jsonb,text,boolean) to ahaa_operations;
notify pgrst, 'reload schema';
commit;
