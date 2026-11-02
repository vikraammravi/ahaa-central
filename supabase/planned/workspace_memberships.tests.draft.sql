-- STAGING REHEARSAL ONLY. Requires isolation_fixture from the isolation assertions.
begin;
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from isolation_fixture;
set local role authenticated;
do $$
declare f isolation_fixture%rowtype; changes jsonb; result jsonb; actor public.profiles%rowtype; member public.profiles%rowtype;
begin
 select * into f from isolation_fixture;
 select * into actor from public.profiles where id=f.admin_id;
 select * into member from public.profiles where id=f.manager_id;
 if jsonb_array_length(public.my_workspaces())<>2 then raise exception 'Own workspace choices missing'; end if;
 result=public.business_users(0,'',null,'');
 if (result->>'count')::integer<>(select count(*) from public.business_memberships where business_id=f.business_a) then raise exception 'Membership user count incorrect'; end if;
 -- A manager in two businesses must not have global identity overwritten by one admin.
 changes=jsonb_build_object('full_name',member.full_name||' changed','phone',member.phone,'role','BRANCH_MANAGER','status','active','location_id',f.branch_a);
 begin perform public.update_business_member(f.manager_id,changes); raise exception 'Shared identity changed';
 exception when raise_exception then if sqlerrm not like 'Shared account identity%' then raise; end if; end;
 -- Scoped role/status can change without changing the other business.
 changes=changes||jsonb_build_object('full_name',member.full_name,'status','disabled');
 perform public.update_business_member(f.manager_id,changes);
 if exists(select 1 from public.business_memberships where business_id=f.business_b and user_id=f.manager_id and status::text<>'active') then raise exception 'Foreign membership disabled'; end if;
 changes=jsonb_build_object('full_name',actor.full_name,'phone',actor.phone,'role','CENTRAL_ADMIN','status','disabled','location_id',null);
 begin perform public.update_business_member(f.admin_id,changes); raise exception 'Last admin disabled';
 exception when raise_exception then if sqlerrm<>'Keep at least one active business admin' then raise; end if; end;
 begin perform public.remove_business_member(f.admin_id); raise exception 'Own access removed';
 exception when raise_exception then if sqlerrm='Own access removed' then raise; end if; end;
 if not public.remove_business_member(f.manager_id) then raise exception 'Member removal failed'; end if;
 if not exists(select 1 from public.business_memberships where business_id=f.business_b and user_id=f.manager_id and status::text='active') then raise exception 'Other business access was removed'; end if;
 -- Global Data API cannot bypass membership guards.
 begin update public.profiles set status='disabled' where id=f.admin_id; raise exception 'Global access bypass accepted';
 exception when raise_exception then if sqlerrm='Global access bypass accepted' then raise; end if; end;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from public.profiles where id=(select manager_id from isolation_fixture)) then raise exception 'Identity was removed'; end if;
end; $$;

-- Restore the temporary Ahaa membership before original Ahaa regression checks.
insert into public.business_memberships(business_id,user_id,role,status,location_id)
select business_a,manager_id,'BRANCH_MANAGER','active',branch_a from isolation_fixture;
select set_config('request.jwt.claim.sub',manager_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from isolation_fixture;
set local role authenticated;
do $$ declare f isolation_fixture%rowtype; begin
 select * into f from isolation_fixture;
 begin perform public.remove_business_member(f.admin_id); raise exception 'Manager removed an admin';
 exception when raise_exception then if sqlerrm='Manager removed an admin' then raise; end if; end;
end; $$;
reset role;
select 'PASS: workspace choices, scoped users, shared identity, last-admin guard, membership-only removal and global-profile bypass denial' as result;

-- New Auth fixture exists only in this transaction; no password or email is issued.
do $$
declare f isolation_fixture%rowtype; new_user uuid:=gen_random_uuid();
begin
 select * into f from isolation_fixture;
 if has_function_privilege('authenticated','public.assign_new_business_user(uuid,uuid,uuid,text,text,uuid)','EXECUTE') then raise exception 'Browser can call identity provisioning'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(new_user,'isolation-'||new_user::text||'@example.invalid','{}');
 if public.assign_new_business_user(f.business_a,f.manager_id,new_user,'Fixture employee','BRANCH_EMPLOYEE',f.branch_a) then raise exception 'Manager provisioned an identity'; end if;
 if public.assign_new_business_user(f.business_a,f.admin_id,new_user,'Fixture employee','BRANCH_EMPLOYEE',f.branch_b) then raise exception 'Foreign branch assignment accepted'; end if;
 if not public.assign_new_business_user(f.business_a,f.admin_id,new_user,'Fixture employee','BRANCH_EMPLOYEE',f.branch_a) then raise exception 'Authorized assignment failed'; end if;
 if not exists(select 1 from public.business_memberships where user_id=new_user and business_id=f.business_a and role::text='BRANCH_EMPLOYEE' and status::text='active') then raise exception 'Assignment role/scope incorrect'; end if;
 if public.assign_new_business_user(f.business_b,f.admin_id,f.manager_id,'Overwrite','BRANCH_EMPLOYEE',f.branch_b) then raise exception 'Shared identity overwritten'; end if;
end; $$;
rollback;
