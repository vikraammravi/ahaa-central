begin;
create table public.weekly_invoices (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.locations(id),
  start_date date not null, end_date date not null, check(start_date<=end_date),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  revision integer not null default 0, sent_revision integer, sent_at timestamptz, sent_by uuid references public.profiles(id)
);
alter table public.weekly_invoices add column needs_sending boolean generated always as (sent_revision is distinct from revision) stored;
create table public.weekly_invoice_publications (
  id uuid primary key default gen_random_uuid(), weekly_invoice_id uuid not null references public.weekly_invoices(id),
  revision integer not null, published_at timestamptz not null default now(), published_by uuid not null references public.profiles(id),
  snapshot jsonb not null, unique(weekly_invoice_id,revision)
);
alter table public.orders add column weekly_invoice_id uuid references public.weekly_invoices(id);
create index orders_weekly_invoice on public.orders(weekly_invoice_id);
alter table public.order_lines add column invoice_quantity integer check(invoice_quantity>=0),
  add column invoice_is_taxable boolean,
  add column invoice_line_total numeric generated always as (coalesce(invoice_quantity,fulfilled_quantity)*unit_price) stored;
alter table public.weekly_invoices enable row level security;
alter table public.weekly_invoice_publications enable row level security;
create policy weekly_invoice_read on public.weekly_invoices for select to authenticated using(public."current_role"()='CENTRAL_ADMIN' or (location_id=public.current_location() and sent_at is not null));
create policy weekly_publication_read on public.weekly_invoice_publications for select to authenticated using(exists(select 1 from public.weekly_invoices w where w.id=weekly_invoice_id));
grant select on public.weekly_invoices,public.weekly_invoice_publications to authenticated;

create function public.guard_billing_fields() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      if new.invoice_quantity is not null or new.invoice_is_taxable is not null then raise exception 'Billing corrections must use the invoice editor.'; end if;
    elsif new.invoice_quantity is distinct from old.invoice_quantity or new.invoice_is_taxable is distinct from old.invoice_is_taxable or new.unit_price is distinct from old.unit_price then
      raise exception 'Invoice quantities and tax must use the invoice editor. Unit prices are locked.';
    end if;
  end if;
  return new;
end; $$;
create trigger order_lines_guard_billing before insert or update on public.order_lines for each row execute function public.guard_billing_fields();
create function public.guard_weekly_order_link() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      if new.weekly_invoice_id is not null or new.pickup_confirmed_by is not null or new.pickup_confirmed_at is not null then raise exception 'Use the invoice or pickup workflow.'; end if;
    elsif new.weekly_invoice_id is distinct from old.weekly_invoice_id or new.pickup_confirmed_by is distinct from old.pickup_confirmed_by or new.pickup_confirmed_at is distinct from old.pickup_confirmed_at then raise exception 'Use the invoice or pickup workflow.'; end if;
  end if;
  return new;
end; $$;
create trigger orders_guard_weekly before insert or update on public.orders for each row execute function public.guard_weekly_order_link();

create or replace function public.recalc_final_order_totals() returns trigger language plpgsql set search_path='' as $$
declare target uuid:=coalesce(new.order_id,old.order_id); sub numeric; tax numeric;
begin
  select coalesce(sum(invoice_line_total),0),coalesce(sum(case when coalesce(invoice_is_taxable,is_taxable) then invoice_line_total*0.13 else 0 end),0)
  into sub,tax from public.order_lines where order_id=target;
  update public.orders set final_subtotal=sub,final_tax_amount=tax,final_total_amount=sub+tax,updated_at=clock_timestamp() where id=target;
  return null;
end; $$;
create or replace function public.invoice_lines_snapshot(p_order_id uuid) returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'order_id',l.order_id,'item_id',l.item_id,'quantity',l.quantity,
    'fulfilled_quantity',coalesce(l.invoice_quantity,l.fulfilled_quantity),'unit_price',l.unit_price,
    'is_taxable',coalesce(l.invoice_is_taxable,l.is_taxable),'line_total',l.line_total,'final_line_total',l.invoice_line_total,
    'shortage_reason',l.shortage_reason,'catalog_items',jsonb_build_object('name',c.name,'unit_type',c.unit_type)) order by l.id),'[]'::jsonb)
  from public.order_lines l left join public.catalog_items c on c.id=l.item_id where l.order_id=p_order_id;
$$;

-- Invoice corrections change billing only; physical quantities and stock
-- remain owned by pickup approval and return receipt.
create or replace function public.edit_invoice(p_order_id uuid,p_lines jsonb,p_reason text,p_expected_updated_at timestamptz)
returns integer language plpgsql security definer set search_path='' as $$
declare target public.orders%rowtype; line record; input jsonb; qty numeric; before_lines jsonb; changed boolean:=false; total integer;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can edit invoices.'; end if;
  select * into target from public.orders where id=p_order_id for update;
  if not found or target.status::text not in ('READY','COMPLETED') then raise exception 'Invoices can be edited when Ready or Completed.'; end if;
  if target.pickup_approval_status='PENDING' or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Resolve pickup approval or returns first.'; end if;
  if target.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice changed. Reload before saving.'; end if;
  if target.weekly_invoice_id is not null then perform 1 from public.weekly_invoices where id=target.weekly_invoice_id for update; end if;
  select count(*) into total from public.order_lines where order_id=target.id;
  if jsonb_typeof(p_lines) is distinct from 'array' or total=0 or jsonb_array_length(p_lines)<>total or (select count(distinct value->>'line_id') from jsonb_array_elements(p_lines))<>total then raise exception 'Provide every invoice line once.'; end if;
  before_lines:=public.invoice_lines_snapshot(target.id);
  for line in select * from public.order_lines where order_id=target.id order by id for update loop
    select value into input from jsonb_array_elements(p_lines) where value->>'line_id'=line.id::text;
    if input is null or jsonb_typeof(input->'quantity') is distinct from 'number' or jsonb_typeof(input->'is_taxable') is distinct from 'boolean' then raise exception 'Invalid invoice values.'; end if;
    qty:=(input->>'quantity')::numeric;
    if qty<0 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Invoice quantity must be a nonnegative whole number.'; end if;
    if input ? 'unit_price' and (input->>'unit_price')::numeric is distinct from line.unit_price then raise exception 'Unit prices are locked.'; end if;
    changed:=changed or qty<>coalesce(line.invoice_quantity,line.fulfilled_quantity) or (input->>'is_taxable')::boolean<>coalesce(line.invoice_is_taxable,line.is_taxable);
    update public.order_lines set invoice_quantity=qty::integer,invoice_is_taxable=(input->>'is_taxable')::boolean where id=line.id;
  end loop;
  if not changed then raise exception 'No changes to save.'; end if;
  update public.orders set invoice_revision=invoice_revision+1,updated_at=clock_timestamp() where id=target.id;
  insert into public.invoice_edits(order_id,revision,edited_by,reason,previous_lines,updated_lines,stock_adjustments)
  values(target.id,target.invoice_revision+1,auth.uid(),coalesce(trim(p_reason),''),before_lines,public.invoice_lines_snapshot(target.id),'[]');
  if target.weekly_invoice_id is not null then update public.weekly_invoices set revision=revision+1 where id=target.weekly_invoice_id; end if;
  return target.invoice_revision+1;
end; $$;

create function public.create_weekly_invoice(p_location_id uuid,p_start_date date,p_end_date date,p_order_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; target public.orders%rowtype; total integer:=0;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can create weekly invoices.'; end if;
  if p_location_id is null or p_start_date is null or p_end_date is null or p_start_date>p_end_date or coalesce(cardinality(p_order_ids),0)=0 then raise exception 'Choose a branch, dates, and completed orders.'; end if;
  if cardinality(p_order_ids)<>(select count(distinct id) from unnest(p_order_ids) id) then raise exception 'Select each order once.'; end if;
  for target in select * from public.orders where id=any(p_order_ids) order by id for update loop
    total:=total+1;
    if target.location_id<>p_location_id or target.order_date<p_start_date or target.order_date>p_end_date or target.status::text is distinct from 'COMPLETED'
      or target.weekly_invoice_id is not null or target.invoice_sent_at is not null or target.pickup_approval_status='PENDING'
      or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Select completed, settled, unbilled orders from the same branch and date range.'; end if;
  end loop;
  if total<>cardinality(p_order_ids) then raise exception 'One of the selected orders is unavailable.'; end if;
  insert into public.weekly_invoices(location_id,start_date,end_date,created_by) values(p_location_id,p_start_date,p_end_date,auth.uid()) returning id into result;
  update public.orders set weekly_invoice_id=result,updated_at=clock_timestamp() where id=any(p_order_ids);
  return result;
end; $$;

create function public.weekly_invoice_details(p_invoice_id uuid,p_live boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare invoice public.weekly_invoices%rowtype; payload jsonb; entries jsonb; orders_json jsonb;
begin
  select * into invoice from public.weekly_invoices where id=p_invoice_id;
  if not found or (public."current_role"() is distinct from 'CENTRAL_ADMIN' and (invoice.location_id is distinct from public.current_location() or invoice.sent_at is null)) then raise exception 'Invoice not accessible.'; end if;
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' or not p_live then
    select snapshot into payload from public.weekly_invoice_publications where weekly_invoice_id=invoice.id order by revision desc limit 1;
    if payload is not null then return payload; end if;
    if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Invoice has not been sent.'; end if;
  end if;
  select coalesce(jsonb_agg(row_data),'[]') into entries from (
    select jsonb_build_object('item_id',l.item_id,'name',c.name,'unit_type',c.unit_type,'unit_price',l.unit_price,
      'is_taxable',coalesce(l.invoice_is_taxable,l.is_taxable),'quantity',sum(coalesce(l.invoice_quantity,l.fulfilled_quantity)),
      'subtotal',sum(l.invoice_line_total),'tax',round(sum(case when coalesce(l.invoice_is_taxable,l.is_taxable) then l.invoice_line_total*0.13 else 0 end),2)) row_data
    from public.order_lines l join public.orders o on o.id=l.order_id left join public.catalog_items c on c.id=l.item_id
    where o.weekly_invoice_id=invoice.id group by l.item_id,c.name,c.unit_type,l.unit_price,coalesce(l.invoice_is_taxable,l.is_taxable) order by c.name,l.unit_price
  ) grouped;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'order_number',order_number,'order_date',order_date,'total',final_total_amount) order by order_date,order_number),'[]') into orders_json from public.orders where weekly_invoice_id=invoice.id;
  select jsonb_build_object('id',invoice.id,'location_id',invoice.location_id,'branch_name',(select name from public.locations where id=invoice.location_id),
    'start_date',invoice.start_date,'end_date',invoice.end_date,'revision',invoice.revision,'sent_at',invoice.sent_at,'lines',entries,'orders',orders_json,
    'subtotal',coalesce(sum(final_subtotal),0),'tax',coalesce(sum(final_tax_amount),0),'total',coalesce(sum(final_total_amount),0)) into payload
    from public.orders where weekly_invoice_id=invoice.id;
  return payload;
end; $$;

create function public.send_weekly_invoice(p_invoice_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
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
  update public.orders set invoice_sent_at=stamp,invoice_sent_by=auth.uid(),invoice_sent_revision=invoice_revision,
    invoice_published_lines=public.invoice_lines_snapshot(id),invoice_published_subtotal=final_subtotal,invoice_published_tax=final_tax_amount,invoice_published_total=final_total_amount where weekly_invoice_id=invoice.id;
  return stamp;
end; $$;
revoke all on function public.create_weekly_invoice(uuid,date,date,uuid[]),public.weekly_invoice_details(uuid,boolean),public.send_weekly_invoice(uuid) from public,anon;
grant execute on function public.create_weekly_invoice(uuid,date,date,uuid[]),public.weekly_invoice_details(uuid,boolean),public.send_weekly_invoice(uuid) to authenticated;

-- Retain correction/resend support for invoices already sent individually;
-- new orders are published through weekly billing only.
alter function public.send_invoice_to_branch(uuid) rename to send_legacy_individual_invoice;
revoke all on function public.send_legacy_individual_invoice(uuid) from public,anon,authenticated;
create function public.send_invoice_to_branch(p_order_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can send invoices.'; end if;
  perform 1 from public.orders where id=p_order_id and invoice_sent_at is not null and weekly_invoice_id is null for update;
  if not found then raise exception 'Select completed orders and create a weekly invoice instead.'; end if;
  return public.send_legacy_individual_invoice(p_order_id);
end; $$;
revoke all on function public.send_invoice_to_branch(uuid) from public,anon;
grant execute on function public.send_invoice_to_branch(uuid) to authenticated;
create function public.guard_settled_order_delete() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and (old.status::text in ('READY','COMPLETED') or old.weekly_invoice_id is not null) then raise exception 'Prepared or billed orders cannot be deleted.'; end if;
  return old;
end; $$;
create trigger orders_keep_history before delete on public.orders for each row execute function public.guard_settled_order_delete();
commit;
