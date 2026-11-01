-- Run after the migration. Everything below is rolled back.
begin;
do $$
declare
  admin_id uuid;
  receipt_id uuid := gen_random_uuid();
  month_key text := to_char(now() at time zone 'UTC','YYYY-MM');
  user_day_key text;
begin
  select id into admin_id from public.profiles where role='CENTRAL_ADMIN' and status='active' limit 1;
  if admin_id is null then raise exception 'An active admin is required for this test'; end if;
  user_day_key := admin_id::text || ':' || to_char(now() at time zone 'America/Toronto','YYYY-MM-DD');
  -- Isolate quota assertions inside this rollback-only transaction.
  update public.purchase_receipts set scan_usage='{}', scan_started_at=null;
  insert into public.purchase_receipts(id,created_by,file_name,file_path,file_hash,model)
  values(receipt_id,admin_id,'test.pdf',receipt_id::text||'/original.pdf',receipt_id::text,'prebuilt-invoice');
  if not public.reserve_receipt_scan(receipt_id,admin_id) then raise exception 'Initial scan blocked'; end if;
  if public.reserve_receipt_scan(receipt_id,admin_id) then raise exception 'Concurrent scan allowed'; end if;
  if (select (scan_usage->>month_key)::int from public.purchase_receipts where id=receipt_id) <> 1 then raise exception 'Scan was not counted'; end if;
  update public.purchase_receipts set scan_started_at=null, scan_status='FAILED', scan_usage=jsonb_build_object(month_key,10,user_day_key,10) where id=receipt_id;
  if public.reserve_receipt_scan(receipt_id,admin_id) then raise exception 'Daily cap bypassed'; end if;
  update public.purchase_receipts set scan_usage=jsonb_build_object(month_key,100) where id=receipt_id;
  if public.reserve_receipt_scan(receipt_id,admin_id) then raise exception 'Monthly cap bypassed'; end if;
  update public.purchase_receipts set scan_usage='{}' where id=receipt_id;
  if public.reserve_receipt_scan(receipt_id,gen_random_uuid()) then raise exception 'Unknown user allowed'; end if;
  if has_function_privilege('authenticated','public.reserve_receipt_scan(uuid,uuid)','EXECUTE') then raise exception 'Client can bypass server authentication'; end if;
  if has_table_privilege('authenticated','public.purchase_receipts','UPDATE') then raise exception 'Client can overwrite scan counts'; end if;
  if (select public from storage.buckets where id='purchase-receipts') then raise exception 'Receipt bucket is public'; end if;
end;
$$;
do $$
declare actor record; receipt_id uuid; other_id uuid; admin_receipt uuid; n integer;
begin
 update public.purchase_receipts set created_at=now()-interval '2 days', scan_usage='{}', scan_started_at=null;
 for actor in select id,role,location_id from public.profiles where status='active' and role in ('CENTRAL_ADMIN','BRANCH_MANAGER') and (role='CENTRAL_ADMIN' or location_id is not null) loop
  for n in 1..12 loop
   receipt_id:=gen_random_uuid();
   if not public.create_purchase_receipt(receipt_id,actor.id,'quota-test.pdf',receipt_id::text,receipt_id::text,'prebuilt-invoice') then raise exception 'Uniform upload allowance blocked early'; end if;
  end loop;
  other_id:=gen_random_uuid();
  update public.purchase_receipts set deleted_at=now() where id=receipt_id;
  if public.reserve_receipt_scan(receipt_id,actor.id) then raise exception 'Archived invoice can scan'; end if;
  select id into receipt_id from public.purchase_receipts where created_by=actor.id and deleted_at is null order by created_at desc limit 1;
  update public.purchase_receipts set scan_usage='{}', scan_started_at=null;
  if not public.reserve_receipt_scan(receipt_id,actor.id) then raise exception 'Authorized actor cannot scan'; end if;
  update public.purchase_receipts set scan_status='FAILED',scan_started_at=null,scan_usage=jsonb_build_object(actor.id::text||':'||to_char(now() at time zone 'America/Toronto','YYYY-MM-DD'),10) where id=receipt_id;
  if public.reserve_receipt_scan(receipt_id,actor.id) then raise exception 'Actor daily scan cap bypassed'; end if;
  if actor.role='CENTRAL_ADMIN' then admin_receipt:=receipt_id;
  elsif admin_receipt is not null then
   update public.purchase_receipts set scan_started_at=null,scan_status='FAILED',scan_usage='{}';
   if public.reserve_receipt_scan(admin_receipt,actor.id) then raise exception 'Manager can scan admin invoice'; end if;
  end if;
 end loop;
 if has_function_privilege('authenticated','public.create_purchase_receipt(uuid,uuid,text,text,text,text)','EXECUTE') then raise exception 'Client can bypass upload authorization'; end if;
end;
$$;
select 'Purchase receipt quota, unlimited uploads and branch access checks passed' as result;
rollback;
