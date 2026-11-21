-- Run only in a single transaction that is rolled back (after the onboarding
-- package). Checks invitation summary, revocation, release, resolution and the
-- assignment guard used by the console. Synthetic identities send no mail.
do $$
declare
  actor uuid; outsider uuid; outsider_email text; customer uuid; second uuid; blocked boolean; row_count integer; outcome text;
  claim uuid := gen_random_uuid(); payload jsonb; invitation uuid; invitee uuid := gen_random_uuid();
  owner_email text := 'fixture-' || gen_random_uuid()::text || '@example.invalid';
  second_email text := 'fixture-' || invitee::text || '@example.invalid';
  first_hash text := repeat('d',64); second_hash text := repeat('e',64); third_hash text := repeat('f',64); fourth_hash text := repeat('9',64);
  latest record;
begin
  select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
    where a.is_active and p.status::text='active' limit 1;
  select id,email into outsider,outsider_email from public.profiles where id<>actor and status::text='active' and email is not null
    and not exists(select 1 from public.platform_administrators a where a.user_id=profiles.id and a.is_active) limit 1;
  if actor is null or outsider is null then raise exception 'Platform test actors unavailable'; end if;
  -- The rate-limit test fills the shared per-minute claim ceiling; start fresh (rolled back).
  update public.platform_owner_invitation_rate set attempts=0, window_start=clock_timestamp();
  if has_function_privilege('anon','public.platform_owner_invitation_summary(uuid[])','EXECUTE')
     or has_function_privilege('anon','public.platform_revoke_owner_invitation(uuid)','EXECUTE')
     or has_function_privilege('anon','public.platform_resolve_owner_invitation(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.platform_release_owner_invitation(uuid,uuid)','EXECUTE') then
    raise exception 'Invitation management exposed beyond its intended callers';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  customer:=(public.platform_create_business('Invitation management fixture','manage-'||replace(gen_random_uuid()::text,'-',''))->>'id')::uuid;
  perform public.platform_issue_owner_invitation(customer,'Owner',owner_email,first_hash);

  -- Non-platform users can neither read status, revoke nor resolve.
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked:=false;
  begin perform * from public.platform_owner_invitation_summary(array[customer]); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-platform user read invitation status'; end if;
  blocked:=false;
  begin perform public.platform_revoke_owner_invitation(customer); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-platform user revoked an invitation'; end if;
  blocked:=false;
  begin perform public.platform_resolve_owner_invitation(customer); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-platform user resolved an invitation'; end if;

  perform set_config('request.jwt.claim.sub',actor::text,true);
  blocked:=false;
  begin perform * from public.platform_owner_invitation_summary(array_fill(gen_random_uuid(),array[201])); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Unbounded invitation summary accepted'; end if;
  select * into latest from public.platform_owner_invitation_summary(array[customer]) s where s.business_id=customer;
  if latest.state<>'issued' or latest.email<>owner_email or latest.expires_at<=clock_timestamp() then raise exception 'Issued invitation not summarised'; end if;
  if exists(select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name=r.specific_name
            where r.routine_schema='public' and r.routine_name='platform_owner_invitation_summary' and p.parameter_name like '%token%') then
    raise exception 'Invitation summary exposes token data';
  end if;

  -- Revocation of an unused link.
  if not public.platform_revoke_owner_invitation(customer) then raise exception 'Unused invitation was not revoked'; end if;
  select * into latest from public.platform_owner_invitation_summary(array[customer]) s where s.business_id=customer;
  if latest.state<>'revoked' then raise exception 'Revocation not reflected in summary'; end if;
  if public.platform_revoke_owner_invitation(customer) then raise exception 'Second revocation reported success'; end if;
  if public.platform_revoke_owner_invitation(gen_random_uuid()) then raise exception 'Unknown business revocation reported success'; end if;
  execute 'set local role service_role';
  if public.platform_claim_owner_invitation(first_hash,gen_random_uuid()) is not null then raise exception 'Revoked invitation was usable'; end if;

  -- A claimed (processing) link blocks revoke, reissue and existing-account assignment.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.platform_issue_owner_invitation(customer,'Owner',owner_email,second_hash);
  execute 'set local role service_role';
  payload:=public.platform_claim_owner_invitation(second_hash,claim);
  invitation:=(payload->>'invitation_id')::uuid;
  if invitation is null then raise exception 'Reissued invitation could not be claimed'; end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if public.platform_revoke_owner_invitation(customer) then raise exception 'Processing invitation was revoked'; end if;
  blocked:=false;
  begin perform public.platform_assign_initial_owner(customer,outsider_email); exception when object_not_in_prerequisite_state then blocked:=true; end;
  if not blocked then raise exception 'Assignment allowed while an invitation was being redeemed'; end if;

  -- Release after a definite Auth rejection: only with the matching claim, and the same link works again.
  execute 'set local role service_role';
  if public.platform_release_owner_invitation(invitation,gen_random_uuid()) then raise exception 'Release accepted a foreign claim'; end if;
  if not public.platform_release_owner_invitation(invitation,claim) then raise exception 'Matching claim was not released'; end if;
  if public.platform_claim_owner_invitation(second_hash,gen_random_uuid()) is null then raise exception 'Released invitation could not be claimed again'; end if;

  -- A redemption claimed moments ago may still be running: resolve must refuse.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  blocked:=false;
  begin perform public.platform_resolve_owner_invitation(customer); exception when object_not_in_prerequisite_state then blocked:=true; end;
  if not blocked then raise exception 'Resolve raced a redemption still in progress'; end if;
  execute 'set local role postgres';
  update public.platform_owner_invitations set claimed_at=clock_timestamp()-interval '10 minutes' where business_id=customer and state='processing';

  -- Resolve without a created login cancels the stuck invitation.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  outcome:=public.platform_resolve_owner_invitation(customer);
  if outcome<>'revoked' then raise exception 'Stuck invitation without login resolved as %', outcome; end if;
  select * into latest from public.platform_owner_invitation_summary(array[customer]) s where s.business_id=customer;
  if latest.state<>'revoked' then raise exception 'Resolved invitation still open'; end if;
  if public.platform_resolve_owner_invitation(customer)<>'none' then raise exception 'Resolve without a stuck invitation did something'; end if;
  execute 'set local role service_role';
  if public.platform_claim_owner_invitation(second_hash,gen_random_uuid()) is not null then raise exception 'Cancelled invitation was usable'; end if;

  -- Resolve with a created login finishes setup (second business; issuance is rate-limited per business).
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  second:=(public.platform_create_business('Invitation resolve fixture','resolve-'||replace(gen_random_uuid()::text,'-',''))->>'id')::uuid;
  perform public.platform_issue_owner_invitation(second,'Second owner',second_email,third_hash);
  execute 'set local role service_role';
  if public.platform_claim_owner_invitation(third_hash,gen_random_uuid()) is null then raise exception 'Second invitation could not be claimed'; end if;
  execute 'set local role postgres';
  update public.platform_owner_invitations set claimed_at=clock_timestamp()-interval '10 minutes' where business_id=second and state='processing';
  -- An unconfirmed login (e.g. self sign-up) is never adopted.
  insert into auth.users(id,email,raw_user_meta_data,created_at) values(invitee,second_email,'{}'::jsonb,clock_timestamp());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  begin
    outcome:=public.platform_resolve_owner_invitation(second);
    if outcome='completed' then raise exception 'Resolve adopted an unconfirmed login'; end if;
    raise exception using errcode='P0001', message='rollback-probe';
  exception when raise_exception then
    if sqlerrm<>'rollback-probe' then raise; end if;
  end;
  -- The confirmed login created by the accept handler is adopted.
  execute 'set local role postgres';
  update auth.users set email_confirmed_at=clock_timestamp() where id=invitee;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  outcome:=public.platform_resolve_owner_invitation(second);
  if outcome<>'completed' then raise exception 'Stuck invitation with login resolved as %', outcome; end if;
  execute 'set local role postgres';
  if not exists(select 1 from public.business_memberships where business_id=second and user_id=invitee and role::text='CENTRAL_ADMIN' and status::text='active')
     or not exists(select 1 from public.profiles where id=invitee and status::text='active' and full_name='Second owner') then
    raise exception 'Resolution did not finish the admin setup';
  end if;
  if exists(select 1 from public.businesses where id=second and (status<>'provisioning' or isolation_ready)) then raise exception 'Resolution activated the business'; end if;

  -- Existing-account assignment revokes an unused link in the same transaction.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  customer:=(public.platform_create_business('Assignment revokes fixture','assign-'||replace(gen_random_uuid()::text,'-',''))->>'id')::uuid;
  perform public.platform_issue_owner_invitation(customer,'Owner','fixture-'||gen_random_uuid()::text||'@example.invalid',fourth_hash);
  execute 'set local role postgres';
  outsider:=gen_random_uuid();
  outsider_email:='fixture-'||outsider::text||'@example.invalid';
  insert into auth.users(id,email,raw_user_meta_data) values(outsider,outsider_email,'{}'::jsonb);
  update public.profiles set status='active' where id=outsider;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.platform_assign_initial_owner(customer,outsider_email);
  select * into latest from public.platform_owner_invitation_summary(array[customer]) s where s.business_id=customer;
  if latest.state<>'revoked' then raise exception 'Assignment left an invitation link usable'; end if;

  execute 'set local role postgres';
  select count(*) into row_count from public.platform_audit_log
    where entity_type='owner_invitation' and operation='UPDATE' and actor_id=actor and next_value->>'state'='revoked'
      and next_value->>'business_id' in (select id::text from public.businesses where name in ('Invitation management fixture'));
  if row_count<>2 then raise exception 'Expected revoke and resolve audit entries, found %', row_count; end if;
  raise notice 'PASS: invitation summary bounds, revocation, release, resolution, assignment guard, audit and privileges';
end $$;
