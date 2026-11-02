-- STAGING ONLY. Requires explicit approval for this account's expanded platform role.
-- Run after the business foundation is installed and verified.
-- Does not grant operational cross-business access or change passwords.
begin;
do $$
declare target uuid;
begin
 select id into strict target from public.profiles
 where lower(email)='admin@aahatrulysouth.com' and role::text='CENTRAL_ADMIN' and status::text='active';
 insert into public.platform_administrators(user_id) values(target)
 on conflict(user_id) do update set is_active=true;
end;
$$;
commit;
