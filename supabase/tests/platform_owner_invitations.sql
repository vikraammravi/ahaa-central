-- Run only in a single transaction that is rolled back. These synthetic
-- identities do not send mail or create a lasting account.
do $$
declare
  actor uuid; outsider uuid; customer uuid; owner_id uuid := gen_random_uuid();
  branch_id uuid := gen_random_uuid(); kitchen_id uuid := gen_random_uuid(); item_id uuid := gen_random_uuid();
  branch_user uuid := gen_random_uuid(); category text := 'Setup category'; unit_name text := 'Setup unit';
  claim_id uuid := gen_random_uuid(); invitation_id uuid; foreign_claim uuid := gen_random_uuid();
  owner_email text := 'fixture-' || owner_id::text || '@example.invalid';
  first_hash text := repeat('a',64); second_hash text := repeat('b',64);
  payload jsonb; blocked boolean; issued_expiry timestamptz;
begin
  select a.user_id into actor from public.platform_administrators a join public.profiles p on p.id=a.user_id
    where a.is_active and p.status::text='active' limit 1;
  select id into outsider from public.profiles where id<>actor and status::text='active' limit 1;
  if actor is null or outsider is null then raise exception 'Staging platform test actors unavailable'; end if;
  if has_table_privilege('authenticated','public.platform_owner_invitations','SELECT')
     or has_function_privilege('authenticated','public.platform_claim_owner_invitation(text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.platform_complete_owner_invitation(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'Invitation secrets or redemption operations exposed';
  end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  payload:=public.platform_create_business('Invitation fixture','invitation-'||replace(gen_random_uuid()::text,'-',''));
  customer:=(payload->>'id')::uuid;
  blocked:=false;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin perform public.platform_issue_owner_invitation(customer,'Owner',owner_email,first_hash);
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-platform user issued invitation'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  issued_expiry:=public.platform_issue_owner_invitation(customer,'Owner',owner_email,first_hash);
  if issued_expiry <= clock_timestamp() then raise exception 'Invitation expiry invalid'; end if;
  -- Reissue must invalidate the previous secret and preserve no access.
  perform public.platform_issue_owner_invitation(customer,'Owner',owner_email,second_hash);
  execute 'set local role service_role';
  if public.platform_claim_owner_invitation(first_hash,gen_random_uuid()) is not null then raise exception 'Revoked invitation was usable'; end if;
  if public.platform_claim_owner_invitation(repeat('c',64),gen_random_uuid()) is not null then raise exception 'Unknown invitation was usable'; end if;
  payload:=public.platform_claim_owner_invitation(second_hash,claim_id);
  if payload->>'email'<>owner_email then raise exception 'Valid invitation could not be claimed'; end if;
  invitation_id:=(payload->>'invitation_id')::uuid;
  if public.platform_claim_owner_invitation(second_hash,foreign_claim) is not null then raise exception 'Invitation replay accepted'; end if;
  if public.platform_complete_owner_invitation(invitation_id,foreign_claim,owner_id) then raise exception 'Mismatched claim completed'; end if;
  execute 'set local role postgres';
  insert into auth.users(id,email,raw_user_meta_data) values(owner_id,owner_email,'{}'::jsonb);
  if not exists(select 1 from public.profiles where id=owner_id and status::text='pending') then raise exception 'Synthetic identity not pending'; end if;
  execute 'set local role service_role';
  if not public.platform_complete_owner_invitation(invitation_id,claim_id,owner_id) then raise exception 'Valid owner setup failed'; end if;
  if public.platform_complete_owner_invitation(invitation_id,claim_id,owner_id) then raise exception 'Completed invitation replay accepted'; end if;
  execute 'set local role postgres';
  if not exists(select 1 from public.business_memberships where business_id=customer and user_id=owner_id and role::text='CENTRAL_ADMIN' and status::text='active') then
    raise exception 'Owner membership missing';
  end if;
  if exists(select 1 from public.businesses where id=customer and (status<>'provisioning' or isolation_ready)) then raise exception 'Invitation bypassed business activation'; end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  payload:=public.activate_platform_business(customer);
  if payload->>'status'<>'active' then raise exception 'Business activation failed after owner setup'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.headers',jsonb_build_object('x-business-id',customer)::text,true);
  if public.current_business_id() is distinct from customer then raise exception 'New owner cannot enter own workspace'; end if;
  if exists(select 1 from public.locations where business_id<>customer) then raise exception 'New owner can view foreign locations'; end if;
  if exists(select 1 from public.locations) or exists(select 1 from public.catalog_items)
     or exists(select 1 from public.catalog_categories) or exists(select 1 from public.catalog_units) then
    raise exception 'New business did not start empty';
  end if;
  -- Exercise the same scoped writes used by an admin setting up an empty
  -- business: options before items and a branch before adding its manager.
  insert into public.locations(id,name,is_central) values(kitchen_id,'Fixture kitchen',true),(branch_id,'Fixture branch',false);
  insert into public.catalog_categories(name) values(category);
  insert into public.catalog_units(name) values(unit_name);
  insert into public.catalog_items(id,name,category,unit_type,default_price,is_taxable,available_stock)
    values(item_id,'Fixture product',category,unit_name,10,false,5);
  if not exists(select 1 from public.catalog_items where id=item_id and business_id=customer)
     or (select count(*) from public.locations where id in (kitchen_id,branch_id))<>2 then
    raise exception 'New business setup records were not created in its workspace';
  end if;
  execute 'set local role postgres';
  insert into auth.users(id,email,raw_user_meta_data) values(branch_user,'fixture-'||branch_user::text||'@example.invalid','{}'::jsonb);
  execute 'set local role service_role';
  if not public.assign_new_business_user(customer,owner_id,branch_user,'Fixture manager','BRANCH_MANAGER',branch_id) then
    raise exception 'New business admin could not add a branch manager';
  end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',branch_user::text,true);
  perform set_config('request.headers',jsonb_build_object('x-business-id',customer)::text,true);
  if public.current_business_id() is distinct from customer
     or not exists(select 1 from public.locations where id=branch_id)
     or exists(select 1 from public.locations where business_id<>customer) then
    raise exception 'New branch manager workspace access is incorrect';
  end if;
  execute 'set local role postgres';
end $$;
