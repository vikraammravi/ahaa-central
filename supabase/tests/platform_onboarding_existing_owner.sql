-- Run only in a disposable/rollback-only transaction against isolated staging,
-- after installing the matching onboarding draft inside the same transaction.
-- Uses existing identities but creates no Auth account and sends no email.
do $$
declare
 actor uuid; owner_id uuid; owner_email text; original_business uuid; original_location uuid;
 customer uuid; payload jsonb; blocked boolean; test_slug text := 'onboarding-test-' || replace(gen_random_uuid()::text,'-','');
begin
 select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
   where a.is_active and p.status::text='active' limit 1;
 select p.id,p.email into owner_id,owner_email from public.profiles p
   where p.status::text='active' and p.id<>actor and p.email is not null limit 1;
 select b.id,l.id into original_business,original_location from public.businesses b join public.locations l on l.business_id=b.id
   where b.status='active' and b.isolation_ready limit 1;
 if actor is null or owner_id is null or original_business is null then raise exception 'Staging onboarding test prerequisites unavailable'; end if;
 if has_function_privilege('anon','public.activate_platform_business(uuid)','EXECUTE') then raise exception 'Anonymous activation privilege'; end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 blocked:=false;
 begin perform public.platform_create_business('Unauthorized',test_slug); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Non-platform user created business'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 payload:=public.platform_create_business('Onboarding fixture',test_slug);
 customer:=(payload->>'id')::uuid;
 if payload->>'status'<>'provisioning' or (payload->>'isolation_ready')::boolean then raise exception 'New business activated prematurely'; end if;
 blocked:=false;
 begin perform public.activate_platform_business(customer); exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Business activated without owner'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 blocked:=false;
 begin perform public.platform_assign_initial_owner(customer,owner_email); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Non-platform user assigned first admin'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.platform_assign_initial_owner(customer,owner_email);
 blocked:=false;
 begin perform public.platform_assign_initial_owner(customer,owner_email); exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate owner assignment accepted'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 blocked:=false;
 begin perform public.activate_platform_business(customer); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Business admin activated tenant'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 payload:=public.activate_platform_business(customer);
 if payload->>'status'<>'active' or not (payload->>'isolation_ready')::boolean then raise exception 'Activation did not return active isolated business'; end if;
 if not exists(select 1 from public.platform_audit_log where actor_id=actor and entity_type='businesses' and entity_id=customer::text
   and operation='UPDATE' and next_value->>'status'='active') then raise exception 'Activation audit missing'; end if;
 blocked:=false;
 begin perform public.activate_platform_business(customer); exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Duplicate activation accepted'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.headers',jsonb_build_object('x-business-id',customer)::text,true);
 if public.current_business_id() is distinct from customer then raise exception 'Activated admin cannot resolve new workspace'; end if;
 execute 'set local role postgres';
 -- Table reads under a workspace switched mid-block hit a cached plan of the
 -- workspace helpers; each app request is its own statement, so check there.
 perform set_config('onboarding_test.owner',owner_id::text,true);
 perform set_config('onboarding_test.business',customer::text,true);
 perform set_config('onboarding_test.original_location',original_location::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('onboarding_test.owner'),true);
select set_config('request.headers',jsonb_build_object('x-business-id',current_setting('onboarding_test.business'))::text,true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.locations where id=current_setting('onboarding_test.original_location')::uuid) then
   raise exception 'Activated admin can see another business location';
 end if;
 if exists(select 1 from public.locations where business_id<>current_setting('onboarding_test.business')::uuid) then
   raise exception 'Activated admin can see locations outside the new business';
 end if;
end $$;
reset role;
