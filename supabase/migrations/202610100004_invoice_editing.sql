begin;
alter table public.orders
  add column invoice_revision integer not null default 0,
  add column invoice_sent_revision integer not null default 0,
  add column invoice_published_lines jsonb,
  add column invoice_published_subtotal numeric,
  add column invoice_published_tax numeric,
  add column invoice_published_total numeric;

create function public.invoice_lines_snapshot(p_order_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'order_id', l.order_id, 'item_id', l.item_id,
    'quantity', l.quantity, 'fulfilled_quantity', l.fulfilled_quantity,
    'unit_price', l.unit_price, 'is_taxable', l.is_taxable,
    'line_total', l.line_total, 'final_line_total', l.final_line_total,
    'shortage_reason', l.shortage_reason,
    'catalog_items', jsonb_build_object('name', c.name, 'unit_type', c.unit_type)
  ) order by l.id), '[]'::jsonb)
  from public.order_lines l left join public.catalog_items c on c.id = l.item_id
  where l.order_id = p_order_id;
$$;

-- Preserve already-published invoices before any corrections are possible.
update public.orders set
  invoice_published_lines = public.invoice_lines_snapshot(id),
  invoice_published_subtotal = final_subtotal,
  invoice_published_tax = final_tax_amount,
  invoice_published_total = final_total_amount
where invoice_sent_at is not null;

create table public.invoice_edits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  revision integer not null,
  edited_by uuid not null references public.profiles(id),
  edited_at timestamptz not null default now(),
  reason text not null,
  previous_lines jsonb not null,
  updated_lines jsonb not null,
  stock_adjustments jsonb not null,
  unique(order_id, revision)
);
alter table public.invoice_edits enable row level security;
create policy invoice_edits_admin_read on public.invoice_edits for select to authenticated
using (public.current_role() = 'CENTRAL_ADMIN');
grant select on public.invoice_edits to authenticated;

create or replace function public.guard_invoice_delivery() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.invoice_sent_at is not null or new.invoice_sent_by is not null
        or new.invoice_revision <> 0 or new.invoice_sent_revision <> 0
        or new.invoice_published_lines is not null or new.invoice_published_subtotal is not null
        or new.invoice_published_tax is not null or new.invoice_published_total is not null then
        raise exception 'Invoice revisions and publication are managed by the invoice workflow.';
      end if;
    elsif new.invoice_sent_at is distinct from old.invoice_sent_at
      or new.invoice_sent_by is distinct from old.invoice_sent_by
      or new.invoice_revision is distinct from old.invoice_revision
      or new.invoice_sent_revision is distinct from old.invoice_sent_revision
      or new.invoice_published_lines is distinct from old.invoice_published_lines
      or new.invoice_published_subtotal is distinct from old.invoice_published_subtotal
      or new.invoice_published_tax is distinct from old.invoice_published_tax
      or new.invoice_published_total is distinct from old.invoice_published_total then
      raise exception 'Invoice revisions and publication are managed by the invoice workflow.';
    end if;
  end if;
  return new;
end;
$$;

create function public.edit_invoice(p_order_id uuid, p_lines jsonb, p_reason text, p_expected_updated_at timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype; target public.orders%rowtype;
  line record; item record; proposal jsonb; qty numeric; price numeric;
  available integer; adjustment integer; restock boolean; total_lines integer;
  before_lines jsonb; adjustments jsonb := '[]'::jsonb;
  changed boolean := false;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role::text <> 'CENTRAL_ADMIN' or actor.status::text <> 'active' then
    raise exception 'Only an active central admin can edit invoices.';
  end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if target.status::text is null or target.status::text not in ('SUBMITTED', 'PREPARING', 'READY', 'COMPLETED') then raise exception 'Cancelled invoices cannot be edited.'; end if;
  if target.pickup_approval_status = 'PENDING' then raise exception 'Review the pending pickup request before editing the invoice.'; end if;
  if target.updated_at is distinct from p_expected_updated_at then raise exception 'This invoice changed while you were editing. Reload it and review the latest values.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Add a reason for the invoice correction.'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Provide invoice lines as a list.'; end if;
  select count(*) into total_lines from public.order_lines where order_id = target.id;
  if total_lines = 0 or jsonb_array_length(p_lines) <> total_lines
    or (select count(distinct value->>'line_id') from jsonb_array_elements(p_lines)) <> total_lines then
    raise exception 'Provide each invoice line exactly once.';
  end if;
  before_lines := public.invoice_lines_snapshot(target.id);
  for line in select * from public.order_lines where order_id = target.id order by id for update loop
    select value into proposal from jsonb_array_elements(p_lines) where value->>'line_id' = line.id::text;
    if proposal is null or jsonb_typeof(proposal->'quantity') is distinct from 'number'
      or jsonb_typeof(proposal->'unit_price') is distinct from 'number'
      or jsonb_typeof(proposal->'is_taxable') is distinct from 'boolean' then raise exception 'Invalid invoice line values.'; end if;
    qty := (proposal->>'quantity')::numeric;
    price := (proposal->>'unit_price')::numeric;
    if qty <> trunc(qty) or qty < 0 or qty > line.quantity then raise exception 'Billed quantities must be whole numbers within the original request.'; end if;
    if price < 0 or price > 99999999.99 or price <> round(price, 2) then raise exception 'Unit prices must be nonnegative with at most two decimal places.'; end if;
    if qty <> line.fulfilled_quantity or price <> line.unit_price or (proposal->>'is_taxable')::boolean <> line.is_taxable then changed := true; end if;
    adjustment := 0;
    restock := null;
    if target.stock_deducted_at is not null then
      adjustment := line.fulfilled_quantity - qty::integer;
      if adjustment > 0 then
        if jsonb_typeof(proposal->'return_to_stock') is distinct from 'boolean' then
          raise exception 'Choose return to stock or unavailable for each reduced quantity.';
        end if;
        restock := (proposal->>'return_to_stock')::boolean;
        if not restock then adjustment := 0; end if;
      end if;
    end if;
    adjustments := adjustments || jsonb_build_array(jsonb_build_object(
      'line_id', line.id, 'item_id', line.item_id, 'adjustment', adjustment,
      'previous_quantity', line.fulfilled_quantity, 'quantity', qty, 'return_to_stock', restock
    ));
  end loop;
  if not changed then raise exception 'No invoice changes to save.'; end if;
  for item in select (value->>'item_id')::uuid as item_id, sum((value->>'adjustment')::integer)::integer as adjustment
    from jsonb_array_elements(adjustments) group by (value->>'item_id')::uuid order by item_id
  loop
    if item.adjustment = 0 then continue; end if;
    select available_stock into available from public.catalog_items where id = item.item_id for update;
    if not found or available is null or available + item.adjustment < 0 then raise exception 'Insufficient stock for the increased invoice quantity.'; end if;
    update public.catalog_items set available_stock = available_stock + item.adjustment, updated_at = now() where id = item.item_id;
  end loop;
  update public.order_lines l set
    fulfilled_quantity = (input_line.value->>'quantity')::integer,
    unit_price = (input_line.value->>'unit_price')::numeric,
    is_taxable = (input_line.value->>'is_taxable')::boolean
  from jsonb_array_elements(p_lines) input_line where l.order_id = target.id and l.id::text = input_line.value->>'line_id';
  update public.orders set invoice_revision = invoice_revision + 1, updated_at = clock_timestamp() where id = target.id;
  insert into public.invoice_edits (order_id, revision, edited_by, reason, previous_lines, updated_lines, stock_adjustments)
  values (target.id, target.invoice_revision + 1, actor.id, trim(p_reason), before_lines, public.invoice_lines_snapshot(target.id), adjustments);
  return target.invoice_revision + 1;
end;
$$;

create or replace function public.send_invoice_to_branch(p_order_id uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.orders%rowtype; sent_at timestamptz;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role::text <> 'CENTRAL_ADMIN' or actor.status::text <> 'active' then raise exception 'Only an active central admin can send an invoice.'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if target.status::text is distinct from 'COMPLETED' then raise exception 'Complete pickup before sending the final invoice.'; end if;
  if target.invoice_sent_at is not null and target.invoice_sent_revision = target.invoice_revision then return target.invoice_sent_at; end if;
  sent_at := clock_timestamp();
  update public.orders set invoice_sent_at = sent_at, invoice_sent_by = actor.id,
    invoice_sent_revision = invoice_revision, invoice_published_lines = public.invoice_lines_snapshot(id),
    invoice_published_subtotal = final_subtotal, invoice_published_tax = final_tax_amount,
    invoice_published_total = final_total_amount, updated_at = sent_at where id = target.id;
  return sent_at;
end;
$$;
revoke all on function public.edit_invoice(uuid, jsonb, text, timestamptz) from public, anon;
grant execute on function public.edit_invoice(uuid, jsonb, text, timestamptz) to authenticated;
revoke all on function public.invoice_lines_snapshot(uuid) from public, anon;
grant execute on function public.invoice_lines_snapshot(uuid) to authenticated;
commit;
