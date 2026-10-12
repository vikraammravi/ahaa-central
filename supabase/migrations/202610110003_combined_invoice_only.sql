begin;
drop function if exists public.send_invoice_to_branch(uuid);
drop function if exists public.send_legacy_individual_invoice(uuid);
drop trigger if exists orders_guard_invoice_delivery on public.orders;
drop function if exists public.guard_invoice_delivery();
create function public.guard_invoice_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if (tg_op='INSERT' and new.invoice_revision<>0) or (tg_op='UPDATE' and new.invoice_revision is distinct from old.invoice_revision) then raise exception 'Use the invoice editor.'; end if;
 end if;
 return new;
end; $$;
create trigger orders_guard_invoice_revision before insert or update on public.orders for each row execute function public.guard_invoice_revision();
create or replace function public.create_weekly_invoice(p_location_id uuid,p_start_date date,p_end_date date,p_order_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; target public.orders%rowtype; total integer:=0;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can create weekly invoices.'; end if;
  if p_location_id is null or p_start_date is null or p_end_date is null or p_start_date>p_end_date or coalesce(cardinality(p_order_ids),0)=0 then raise exception 'Choose a branch, dates, and completed orders.'; end if;
  if cardinality(p_order_ids)<>(select count(distinct id) from unnest(p_order_ids) id) then raise exception 'Select each order once.'; end if;
  for target in select * from public.orders where id=any(p_order_ids) order by id for update loop
    total:=total+1;
    if target.location_id<>p_location_id or target.order_date<p_start_date or target.order_date>p_end_date or target.status::text is distinct from 'COMPLETED'
      or target.weekly_invoice_id is not null or target.pickup_approval_status='PENDING'
      or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Select completed, settled, unbilled orders from the same branch and date range.'; end if;
  end loop;
  if total<>cardinality(p_order_ids) then raise exception 'One of the selected orders is unavailable.'; end if;
  insert into public.weekly_invoices(location_id,start_date,end_date,created_by) values(p_location_id,p_start_date,p_end_date,auth.uid()) returning id into result;
  update public.orders set weekly_invoice_id=result,updated_at=clock_timestamp() where id=any(p_order_ids);
  return result;
end; $$;

create or replace function public.send_weekly_invoice(p_invoice_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare invoice public.weekly_invoices%rowtype; payload jsonb; stamp timestamptz;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can send weekly invoices.'; end if;
  -- Lock linked orders before the invoice, matching the edit lock order.
  perform 1 from public.orders where weekly_invoice_id=p_invoice_id order by id for update;
  select * into invoice from public.weekly_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Weekly invoice not found.'; end if;
  if invoice.sent_revision=invoice.revision then return invoice.sent_at; end if;
  if exists(select 1 from public.orders o where o.weekly_invoice_id=invoice.id and (o.status::text is distinct from 'COMPLETED' or o.pickup_approval_status='PENDING' or exists(select 1 from public.pickup_requests r where r.order_id=o.id and r.return_status='PENDING'))) then raise exception 'Resolve pending pickup approvals or returns before sending.'; end if;
  payload:=public.weekly_invoice_details(invoice.id,true); stamp:=clock_timestamp(); payload:=payload||jsonb_build_object('sent_at',stamp);
  insert into public.weekly_invoice_publications(weekly_invoice_id,revision,published_by,snapshot) values(invoice.id,invoice.revision,auth.uid(),payload);
  update public.weekly_invoices set sent_revision=revision,sent_at=stamp,sent_by=auth.uid() where id=invoice.id;
  return stamp;
end; $$;

alter table public.orders drop column invoice_sent_at, drop column invoice_sent_by, drop column invoice_sent_revision, drop column invoice_published_lines, drop column invoice_published_subtotal, drop column invoice_published_tax, drop column invoice_published_total;
commit;
