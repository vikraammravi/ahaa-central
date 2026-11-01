-- Reviewed purchase receipts are separate from branch sales invoices. No stock changes.
begin;
create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  file_name text not null,
  file_path text not null unique,
  file_hash text not null unique,
  model text not null check (model in ('prebuilt-invoice','prebuilt-receipt')),
  category text not null default 'Miscellaneous',
  status text not null default 'DRAFT' check (status in ('DRAFT','SAVED')),
  scan_status text not null default 'NOT_SCANNED' check (scan_status in ('NOT_SCANNED','RUNNING','SUCCEEDED','FAILED')),
  operation_url text,
  scan_started_at timestamptz,
  scan_usage jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb
);
create index purchase_receipts_created_at_idx on public.purchase_receipts(created_at desc);
alter table public.purchase_receipts enable row level security;
revoke all on public.purchase_receipts from anon, authenticated;
grant select on public.purchase_receipts to authenticated;
create policy purchase_receipts_admin_read on public.purchase_receipts for select to authenticated using (
  exists(select 1 from public.profiles where id=auth.uid() and role='CENTRAL_ADMIN' and status='active')
);
-- Conservative cap: 200 scans x at most two pages = 400 pages/month.
-- Failed requests also count locally. Other tools using this Azure resource aren't counted.
create function public.reserve_receipt_scan(p_receipt_id uuid, p_user_id uuid) returns boolean
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
  where id=p_receipt_id;
  return found;
end;
$$;
revoke all on function public.reserve_receipt_scan(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_receipt_scan(uuid,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('purchase-receipts','purchase-receipts',false,4000000,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do nothing;
-- No client Storage policies: access is through the authenticated admin API only.
commit;
