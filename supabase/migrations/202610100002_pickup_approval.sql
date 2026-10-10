begin;

alter table public.orders add column if not exists pickup_approval_status text
  check (pickup_approval_status in ('PENDING', 'APPROVED', 'REJECTED'));

create table public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reason text not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text
);
create unique index pickup_requests_one_pending on public.pickup_requests(order_id) where status = 'PENDING';
create index pickup_requests_order_history on public.pickup_requests(order_id, requested_at desc);

create table public.pickup_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pickup_requests(id),
  order_line_id uuid not null references public.order_lines(id),
  item_id uuid not null references public.catalog_items(id),
  prepared_quantity integer not null check (prepared_quantity >= 0),
  pickup_quantity integer not null check (pickup_quantity >= 0),
  return_to_stock boolean,
  stock_adjustment integer not null default 0,
  unique (request_id, order_line_id)
);
alter table public.pickup_requests enable row level security;
alter table public.pickup_request_lines enable row level security;
create policy pickup_requests_read on public.pickup_requests for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and
    (public.current_role() = 'CENTRAL_ADMIN' or o.location_id = public.current_location()))
);
create policy pickup_request_lines_read on public.pickup_request_lines for select to authenticated using (
  exists (select 1 from public.pickup_requests r where r.id = request_id)
);
grant select on public.pickup_requests, public.pickup_request_lines to authenticated;

-- Browser writes cannot bypass approval, invoice calculation, or the frozen
-- prepared quantities. RPCs below run as their owner only after checking auth.
create function public.guard_pickup_order_writes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.pickup_approval_status is not null then raise exception 'Pickup approval is managed by the pickup workflow.'; end if;
      return new;
    end if;
    if new.pickup_approval_status is distinct from old.pickup_approval_status then
      raise exception 'Pickup approval is managed by the pickup workflow.';
    end if;
    if new.status::text = 'COMPLETED' and old.status::text <> 'COMPLETED' then
      raise exception 'Complete pickup through the pickup confirmation or approval workflow.';
    end if;
    if old.pickup_approval_status = 'PENDING' and new.status is distinct from old.status then
      raise exception 'Review the pending pickup request first.';
    end if;
    if public.current_role() <> 'CENTRAL_ADMIN' and new.status is distinct from old.status
      and not (old.status::text = 'SUBMITTED' and new.status::text = 'CANCELLED') then
      raise exception 'Only central admin can advance preparation status.';
    end if;
    if old.status::text in ('READY', 'COMPLETED') and (
      new.final_subtotal is distinct from old.final_subtotal or
      new.final_tax_amount is distinct from old.final_tax_amount or
      new.final_total_amount is distinct from old.final_total_amount
    ) then raise exception 'Pickup totals are managed by the pickup workflow.'; end if;
  end if;
  return new;
end;
$$;
create trigger orders_guard_pickup before insert or update on public.orders
for each row execute function public.guard_pickup_order_writes();

create function public.guard_pickup_line_writes() returns trigger
language plpgsql set search_path = '' as $$
declare target_order uuid; state text;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then target_order := old.order_id; else target_order := new.order_id; end if;
    -- Serialize line edits with readiness and pickup approval.
    select status::text into state from public.orders where id = target_order for update;
    if state in ('READY', 'COMPLETED', 'CANCELLED') then
      raise exception 'Prepared order quantities can only change through pickup approval.';
    end if;
    if tg_op <> 'INSERT' and public.current_role() <> 'CENTRAL_ADMIN' then
      raise exception 'Only central admin can edit fulfillment quantities.';
    end if;
    if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
      raise exception 'Order lines cannot be moved between orders.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger order_lines_guard_pickup before insert or update or delete on public.order_lines
for each row execute function public.guard_pickup_line_writes();

create function public.submit_pickup(p_order_id uuid, p_quantities jsonb, p_reason text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype; target public.orders%rowtype;
  line record; proposal jsonb; qty numeric; request_id uuid;
  changes boolean := false; line_count integer;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.status::text <> 'active' or actor.role::text <> 'BRANCH_MANAGER' then
    raise exception 'Only an active branch manager can confirm pickup.';
  end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.location_id is distinct from actor.location_id then raise exception 'Order not accessible.'; end if;
  if target.status::text <> 'READY' or target.stock_deducted_at is null then raise exception 'This order is not ready for pickup.'; end if;
  if target.pickup_approval_status = 'PENDING' then raise exception 'A pickup request is already awaiting approval.'; end if;
  if jsonb_typeof(p_quantities) is distinct from 'array' then raise exception 'Pickup quantities must be a list.'; end if;
  select count(*) into line_count from public.order_lines where order_id = target.id;
  if line_count = 0 or jsonb_array_length(p_quantities) <> line_count then raise exception 'Provide each order line exactly once.'; end if;
  if (select count(distinct value->>'line_id') from jsonb_array_elements(p_quantities)) <> line_count then
    raise exception 'Provide each order line exactly once.';
  end if;
  for line in select * from public.order_lines where order_id = target.id order by id for update loop
    select value into proposal from jsonb_array_elements(p_quantities) where value->>'line_id' = line.id::text;
    if proposal is null or jsonb_typeof(proposal->'quantity') is distinct from 'number' then raise exception 'Invalid pickup quantity.'; end if;
    qty := (proposal->>'quantity')::numeric;
    if qty <> trunc(qty) or qty < 0 or qty > line.quantity then raise exception 'Pickup must be a whole number between zero and the requested quantity.'; end if;
    if qty <> line.fulfilled_quantity then changes := true; end if;
  end loop;
  if not changes then
    update public.orders set status = 'COMPLETED', pickup_approval_status = null, updated_at = now() where id = target.id;
    return 'COMPLETED';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Add a reason for the pickup change.'; end if;
  insert into public.pickup_requests (order_id, reason, requested_by)
  values (target.id, trim(p_reason), actor.id) returning id into request_id;
  insert into public.pickup_request_lines (request_id, order_line_id, item_id, prepared_quantity, pickup_quantity)
  select request_id, l.id, l.item_id, l.fulfilled_quantity, (q.value->>'quantity')::integer
  from public.order_lines l join jsonb_array_elements(p_quantities) q on q.value->>'line_id' = l.id::text
  where l.order_id = target.id;
  update public.orders set pickup_approval_status = 'PENDING', updated_at = now() where id = target.id;
  return 'PENDING';
end;
$$;

create function public.review_pickup(p_request_id uuid, p_approve boolean, p_note text default '', p_returns jsonb default '{}')
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype; target public.orders%rowtype;
  request public.pickup_requests%rowtype; line record; item record;
  target_order uuid; available integer; adjustment integer; restock boolean;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.status::text <> 'active' or actor.role::text <> 'CENTRAL_ADMIN' then
    raise exception 'Only an active central admin can review pickup.';
  end if;
  if p_approve is null then raise exception 'Choose approve or reject.'; end if;
  select order_id into target_order from public.pickup_requests where id = p_request_id;
  if not found then raise exception 'Pickup request not found.'; end if;
  select * into target from public.orders where id = target_order for update;
  select * into request from public.pickup_requests where id = p_request_id for update;
  if request.status <> 'PENDING' or target.status::text <> 'READY' or target.pickup_approval_status <> 'PENDING' then
    raise exception 'This pickup request is no longer pending.';
  end if;
  if not p_approve then
    if coalesce(trim(p_note), '') = '' then raise exception 'Add a reason for rejection.'; end if;
    update public.pickup_requests set status = 'REJECTED', reviewed_by = actor.id, reviewed_at = now(), review_note = trim(p_note) where id = request.id;
    update public.orders set pickup_approval_status = 'REJECTED', updated_at = now() where id = target.id;
    return 'REJECTED';
  end if;
  if jsonb_typeof(p_returns) is distinct from 'object' then raise exception 'Invalid return decisions.'; end if;
  for line in
    select r.*, l.fulfilled_quantity, l.quantity from public.pickup_request_lines r
    join public.order_lines l on l.id = r.order_line_id where r.request_id = request.id order by l.id for update of l
  loop
    if line.fulfilled_quantity <> line.prepared_quantity or line.pickup_quantity > line.quantity then
      raise exception 'Prepared quantities changed. Reload and review this request.';
    end if;
    restock := null;
    adjustment := line.prepared_quantity - line.pickup_quantity;
    if adjustment > 0 then
      if jsonb_typeof(p_returns->line.order_line_id::text) is distinct from 'boolean' then
        raise exception 'Choose return to stock or unavailable for every reduced pickup item.';
      end if;
      restock := (p_returns->>line.order_line_id::text)::boolean;
      if not restock then adjustment := 0; end if;
    end if;
    update public.pickup_request_lines set return_to_stock = restock, stock_adjustment = adjustment where id = line.id;
  end loop;
  -- Group duplicate products and lock them consistently. Any failure rolls
  -- back stock, line quantities, review, invoice, and completion together.
  for item in select item_id, sum(stock_adjustment)::integer as adjustment
    from public.pickup_request_lines where request_id = request.id group by item_id order by item_id
  loop
    select available_stock into available from public.catalog_items where id = item.item_id for update;
    if not found or available is null or available + item.adjustment < 0 then
      raise exception 'Insufficient available stock to approve extra pickup.';
    end if;
    update public.catalog_items set available_stock = available_stock + item.adjustment, updated_at = now() where id = item.item_id;
  end loop;
  update public.order_lines l set fulfilled_quantity = r.pickup_quantity
  from public.pickup_request_lines r where r.request_id = request.id and r.order_line_id = l.id;
  update public.pickup_requests set status = 'APPROVED', reviewed_by = actor.id, reviewed_at = now(), review_note = nullif(trim(p_note), '') where id = request.id;
  update public.orders set status = 'COMPLETED', pickup_approval_status = 'APPROVED', updated_at = now() where id = target.id;
  return 'APPROVED';
end;
$$;
revoke all on function public.submit_pickup(uuid, jsonb, text) from public, anon;
revoke all on function public.review_pickup(uuid, boolean, text, jsonb) from public, anon;
grant execute on function public.submit_pickup(uuid, jsonb, text) to authenticated;
grant execute on function public.review_pickup(uuid, boolean, text, jsonb) to authenticated;
commit;
