-- Run immediately after foundation, before explicitly bootstrapping a platform admin.
-- These checks use existing staging identities and never change their passwords.
begin;
do $$
declare first_user uuid; other_user uuid; business uuid; new_business uuid; count_before bigint;
begin
 select id into first_user from public.profiles where status::text='active' order by id limit 1;
 select id into other_user from public.profiles where id<>first_user order by id limit 1;
 if first_user is null or other_user is null then raise exception 'Two staging profiles are required'; end if;
 select id into business from public.businesses where slug='ahaa';
 if (select count(*) from public.business_memberships where business_id=business) <> (select count(*) from public.profiles) then raise exception 'Legacy membership backfill mismatch'; end if;
 if exists(select 1 from public.platform_administrators) then raise exception 'Platform access must not be granted automatically'; end if;
 if exists(select 1 from public.businesses where isolation_ready) then raise exception 'Tenant isolation must remain gated'; end if;
 if has_table_privilege('authenticated','public.businesses','INSERT') or has_table_privilege('authenticated','public.platform_administrators','UPDATE')
   or has_table_privilege('authenticated','public.platform_audit_log','DELETE') then raise exception 'Unexpected browser mutation grant'; end if;
 if has_function_privilege('anon','public.platform_is_administrator()','EXECUTE') then raise exception 'Anonymous platform access'; end if;

 perform set_config('request.jwt.claim.sub',first_user::text,true);
 if public.platform_is_administrator() then raise exception 'Business admin became platform admin'; end if;
 insert into public.platform_administrators(user_id) values(first_user);
 if not public.platform_is_administrator() then raise exception 'Explicit platform role not recognized'; end if;
 update public.platform_administrators set is_active=false where user_id=first_user;
 if public.platform_is_administrator() then raise exception 'Inactive platform role accepted'; end if;
 update public.platform_administrators set is_active=true where user_id=first_user;
 select count(*) into count_before from public.platform_audit_log;
 insert into public.businesses(slug,name) values('isolation-fixture','Isolation fixture') returning id into new_business;
 if (select count(*) from public.platform_audit_log)<>count_before+1 then raise exception 'Business change was not audited'; end if;
 if not exists(select 1 from public.platform_audit_log where entity_id=new_business::text and actor_id=first_user) then raise exception 'Audit actor mismatch'; end if;
 insert into public.business_memberships(business_id,user_id,role,status) values(new_business,other_user,'BRANCH_MANAGER','active');
end;
$$;

-- RLS assertions execute with actual authenticated permissions, not the SQL editor owner.
select set_config('request.jwt.claim.sub',(select user_id::text from public.platform_administrators limit 1),true);
set local role authenticated;
do $$ begin
 if not public.platform_is_administrator() or (select count(*) from public.businesses)<>2 then raise exception 'Platform registry visibility failed'; end if;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',(select m.user_id::text from public.business_memberships m join public.businesses b on b.id=m.business_id where b.slug='isolation-fixture'),true);
set local role authenticated;
do $$ begin
 if public.platform_is_administrator() then raise exception 'Non-platform user granted access'; end if;
 if exists(select 1 from public.business_memberships where user_id<>auth.uid()) then raise exception 'Foreign memberships exposed'; end if;
 if exists(select 1 from public.platform_audit_log) then raise exception 'Audit exposed to non-platform user'; end if;
 if not exists(select 1 from public.businesses where slug='isolation-fixture') then raise exception 'Own business not visible'; end if;
end; $$;
reset role;
select 'PASS: foundation backfill, explicit platform access, audit and registry RLS; operational isolation remains gated' as result;
rollback;
