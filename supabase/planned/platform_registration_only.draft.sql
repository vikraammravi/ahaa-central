-- Staging-only, registration-only release. Creates no user, membership or active business.
-- Do not apply together with platform_console.draft.sql without removing its duplicate function.
begin;
create function public.platform_create_business(p_name text, p_slug text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare result public.businesses;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 or p_slug is null
   or length(p_slug) not between 2 and 60 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
   raise exception 'Invalid business details' using errcode='22023';
 end if;
 insert into public.businesses(name,slug,status,isolation_ready)
 values(trim(p_name),p_slug,'provisioning',false) returning * into result;
 return jsonb_build_object('id',result.id,'name',result.name,'slug',result.slug,'status',result.status,'isolation_ready',result.isolation_ready);
end;
$$;
revoke all on function public.platform_create_business(text,text) from public,anon;
grant execute on function public.platform_create_business(text,text) to authenticated;
commit;
