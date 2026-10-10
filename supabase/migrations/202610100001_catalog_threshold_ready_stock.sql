-- Review existing stock triggers before applying: this must be the only
-- mechanism that deducts catalog stock for orders becoming READY.
alter type public.unit_measurement add value if not exists 'Box';
alter type public.unit_measurement add value if not exists 'Bottle';
alter type public.unit_measurement add value if not exists 'Bag';

begin;

alter table public.catalog_items
  add column if not exists low_stock_threshold integer not null default 20
  check (low_stock_threshold >= 0);

alter table public.orders
  add column if not exists stock_deducted_at timestamptz;

-- Historical ready/completed orders must not deduct inventory again.
update public.orders
set stock_deducted_at = coalesce(updated_at, created_at, now())
where status::text in ('READY', 'COMPLETED') and stock_deducted_at is null;

create or replace function public.deduct_stock_when_order_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item record;
  remaining numeric;
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'SUBMITTED' then
      raise exception 'New orders must be Submitted.';
    end if;
    new.stock_deducted_at := null;
    return new;
  end if;
  -- A client cannot clear or forge the bookkeeping marker.
  new.stock_deducted_at := old.stock_deducted_at;

  if old.stock_deducted_at is not null then
    if new.status::text in ('SUBMITTED', 'PREPARING') then
      raise exception 'An order already prepared cannot return to an earlier status.';
    end if;
    return new;
  end if;

  if new.status::text = 'COMPLETED' then
    raise exception 'Mark the order Ready before completing it.';
  end if;

  if new.status::text = 'READY' and old.status::text is distinct from 'READY' then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role::text = 'CENTRAL_ADMIN' and status::text = 'active'
    ) then
      raise exception 'Only an active central admin can mark an order Ready.';
    end if;

    if not exists (select 1 from public.order_lines where order_id = new.id) then
      raise exception 'Cannot mark an order without line items Ready.';
    end if;

    if exists (
      select 1 from public.order_lines
      where order_id = new.id
        and (fulfilled_quantity is null or fulfilled_quantity < 0 or fulfilled_quantity > quantity)
    ) then
      raise exception 'Save valid fulfillment quantities before marking this order Ready.';
    end if;

    -- Lock products in a consistent order. An insufficient-stock error rolls
    -- back every deduction and the status change in the same transaction.
    for item in
      select item_id, sum(fulfilled_quantity) as quantity
      from public.order_lines where order_id = new.id
      group by item_id order by item_id
    loop
      select available_stock into remaining
      from public.catalog_items where id = item.item_id for update;
      if not found then
        raise exception 'A catalog item on this order no longer exists.';
      end if;
      if remaining < item.quantity then
        raise exception 'Insufficient stock for item %: % available, % fulfilled.', item.item_id, remaining, item.quantity;
      end if;
      update public.catalog_items
      set available_stock = available_stock - item.quantity, updated_at = now()
      where id = item.item_id;
      if not found then
        raise exception 'Unable to update stock for item %.', item.item_id;
      end if;
    end loop;
    new.stock_deducted_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger orders_deduct_stock_when_ready
before insert or update on public.orders
for each row execute function public.deduct_stock_when_order_ready();

commit;
