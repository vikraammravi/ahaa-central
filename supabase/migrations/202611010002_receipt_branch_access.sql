begin;
alter table public.purchase_receipts add column location_id uuid references public.locations(id);
alter table public.purchase_receipts drop constraint purchase_receipts_file_hash_key;
create unique index purchase_receipts_scope_hash_idx on public.purchase_receipts(coalesce(location_id,'00000000-0000-0000-0000-000000000000'::uuid),file_hash);
create index purchase_receipts_scope_created_idx on public.purchase_receipts(location_id,created_at desc);
update public.purchase_receipts set category=case when model='prebuilt-receipt' then 'Store Receipt' else 'Supplier Invoice' end;
alter table public.purchase_receipts alter column category set default 'Supplier Invoice';
alter table public.purchase_receipts add constraint purchase_receipts_category_check check(category in ('Supplier Invoice','Store Receipt'));
drop policy purchase_receipts_admin_read on public.purchase_receipts;
create policy purchase_receipts_scoped_read on public.purchase_receipts for select to authenticated using (
 deleted_at is null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active'
 and ((p.role='CENTRAL_ADMIN' and purchase_receipts.location_id is null) or (p.role='BRANCH_MANAGER' and p.location_id=purchase_receipts.location_id)))
);
-- Atomic upload reservation: deleted rows and failed storage attempts still count.
create function public.create_purchase_receipt(p_id uuid,p_user_id uuid,p_file_name text,p_file_path text,p_file_hash text,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare branch uuid; user_role text;
begin
 perform pg_advisory_xact_lock(730030003);
 select role::text,location_id into user_role,branch from public.profiles where id=p_user_id and status='active';
 if user_role is null or user_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER') or (user_role='BRANCH_MANAGER' and branch is null) then return false; end if;
 if user_role='CENTRAL_ADMIN' then branch:=null; end if;
 if (select count(*) from public.purchase_receipts where created_by=p_user_id and created_at >= (date_trunc('day',now() at time zone 'America/Toronto') at time zone 'America/Toronto')) >= 10 then return false; end if;
 insert into public.purchase_receipts(id,created_by,location_id,file_name,file_path,file_hash,model,category)
 values(p_id,p_user_id,branch,p_file_name,p_file_path,p_file_hash,p_model,case when p_model='prebuilt-receipt' then 'Store Receipt' else 'Supplier Invoice' end)
 on conflict do nothing;
 return found;
end;
$$;
revoke all on function public.create_purchase_receipt(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_purchase_receipt(uuid,uuid,text,text,text,text) to service_role;
create or replace function public.reserve_receipt_scan(p_receipt_id uuid, p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  month_key text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  user_day_key text := p_user_id::text || ':' || to_char(now() at time zone 'America/Toronto', 'YYYY-MM-DD');
begin
  perform pg_advisory_xact_lock(730030003);
  if not exists(select 1 from public.profiles where id=p_user_id and role in ('CENTRAL_ADMIN','BRANCH_MANAGER') and status='active') then return false; end if;
  if (select coalesce(sum((scan_usage->>month_key)::integer),0) from public.purchase_receipts) >= 200
    or (select coalesce(sum((scan_usage->>user_day_key)::integer),0) from public.purchase_receipts) >= 10
    or exists(select 1 from public.purchase_receipts where scan_started_at > now()-interval '5 seconds')
    or exists(select 1 from public.purchase_receipts where id=p_receipt_id and scan_status='RUNNING' and scan_started_at > now()-interval '1 hour') then
    return false;
  end if;
  update public.purchase_receipts set
    scan_usage = jsonb_set(jsonb_set(scan_usage,array[month_key],to_jsonb(coalesce((scan_usage->>month_key)::integer,0)+1)),array[user_day_key],to_jsonb(coalesce((scan_usage->>user_day_key)::integer,0)+1)),
    scan_status='RUNNING', scan_started_at=now(), operation_url=null
  where id=p_receipt_id and deleted_at is null and exists (
    select 1 from public.profiles p where p.id=p_user_id and p.status='active'
    and ((p.role='CENTRAL_ADMIN' and purchase_receipts.location_id is null)
      or (p.role='BRANCH_MANAGER' and p.location_id=purchase_receipts.location_id))
  );
  return found;
end;
$$;
commit;
