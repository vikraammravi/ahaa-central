begin;
alter table public.purchase_receipts add column if not exists deleted_at timestamptz;
create index if not exists purchase_receipts_active_created_idx
  on public.purchase_receipts(created_at desc) where deleted_at is null;
-- Keep archived rows in scan-limit calculations; deletion must not reset quotas.
drop policy if exists purchase_receipts_admin_read on public.purchase_receipts;
create policy purchase_receipts_admin_read on public.purchase_receipts
  for select to authenticated using (
    deleted_at is null and exists (
      select 1 from public.profiles
      where id=auth.uid() and role='CENTRAL_ADMIN' and status='active'
    )
  );
create or replace function public.reserve_receipt_scan(p_receipt_id uuid, p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  month_key text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  user_day_key text := p_user_id::text || ':' || to_char(now() at time zone 'America/Toronto', 'YYYY-MM-DD');
begin
  perform pg_advisory_xact_lock(730030003);
  if not exists(select 1 from public.profiles where id=p_user_id and role='CENTRAL_ADMIN' and status='active') then return false; end if;
  if (select coalesce(sum((scan_usage->>month_key)::integer),0) from public.purchase_receipts) >= 200
    or (select coalesce(sum((scan_usage->>user_day_key)::integer),0) from public.purchase_receipts) >= 10
    or exists(select 1 from public.purchase_receipts where scan_started_at > now()-interval '5 seconds')
    or exists(select 1 from public.purchase_receipts where id=p_receipt_id and scan_status='RUNNING' and scan_started_at > now()-interval '1 hour') then
    return false;
  end if;
  update public.purchase_receipts set
    scan_usage = jsonb_set(jsonb_set(scan_usage,array[month_key],to_jsonb(coalesce((scan_usage->>month_key)::integer,0)+1)),array[user_day_key],to_jsonb(coalesce((scan_usage->>user_day_key)::integer,0)+1)),
    scan_status='RUNNING', scan_started_at=now(), operation_url=null
  where id=p_receipt_id and deleted_at is null;
  return found;
end;
$$;
commit;
