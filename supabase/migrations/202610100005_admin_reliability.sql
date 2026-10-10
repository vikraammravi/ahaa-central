begin;
create or replace function public."current_role"() returns text language sql stable security definer set search_path = '' as $$
  select role::text from public.profiles where id = auth.uid() and status::text = 'active';
$$;
create or replace function public.current_location() returns uuid language sql stable security definer set search_path = '' as $$
  select location_id from public.profiles where id = auth.uid() and status::text = 'active';
$$;

create function public.save_daily_stock(p_updates jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare proposal jsonb; item public.catalog_items%rowtype; quantity numeric; expected numeric; total integer;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can save stock.'; end if;
  if jsonb_typeof(p_updates) is distinct from 'array' or jsonb_array_length(p_updates) = 0 then raise exception 'Provide at least one stock update.'; end if;
  total := jsonb_array_length(p_updates);
  if (select count(distinct value->>'id') from jsonb_array_elements(p_updates)) <> total then raise exception 'Each stock item must appear once.'; end if;
  for proposal in select value from jsonb_array_elements(p_updates) order by value->>'id' loop
    if jsonb_typeof(proposal->'available_stock') is distinct from 'number' or jsonb_typeof(proposal->'expected_stock') is distinct from 'number'
      or not (proposal ? 'expected_updated_at') then raise exception 'Invalid stock update.'; end if;
    quantity := (proposal->>'available_stock')::numeric;
    expected := (proposal->>'expected_stock')::numeric;
    if quantity < 0 or quantity > 2147483647 or quantity <> trunc(quantity) then raise exception 'Stock must be a nonnegative whole number.'; end if;
    select * into item from public.catalog_items where id = (proposal->>'id')::uuid for update;
    if not found or item.is_active is distinct from true then raise exception 'A stock item is missing or inactive.'; end if;
    if item.available_stock is distinct from expected or item.updated_at is distinct from (proposal->>'expected_updated_at')::timestamptz then
      raise exception 'Stock changed while you were editing. No items were saved. Discard edits and refresh before trying again.';
    end if;
    update public.catalog_items set available_stock = quantity::integer, updated_at = clock_timestamp() where id = item.id;
  end loop;
  return total;
end;
$$;

-- Every invoice has a stable business date for server-side date filtering.
update public.orders set order_date = (created_at at time zone 'America/Toronto')::date where order_date is null and created_at is not null;
alter table public.orders alter column order_date set default ((now() at time zone 'America/Toronto')::date);
create index if not exists orders_admin_page on public.orders(created_at desc, id);
create index if not exists orders_admin_filters on public.orders(order_date, location_id, status);

create function public.admin_order_counts(p_start_date date default null, p_end_date date default null, p_location_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can view order counts.'; end if;
  select jsonb_build_object(
    'ALL', count(*), 'SUBMITTED', count(*) filter(where status::text = 'SUBMITTED'),
    'PREPARING', count(*) filter(where status::text = 'PREPARING'), 'READY', count(*) filter(where status::text = 'READY'),
    'COMPLETED', count(*) filter(where status::text = 'COMPLETED'), 'CANCELLED', count(*) filter(where status::text = 'CANCELLED')
  ) into result from public.orders
  where (p_start_date is null or order_date >= p_start_date) and (p_end_date is null or order_date <= p_end_date)
    and (p_location_id is null or location_id = p_location_id);
  return result;
end;
$$;

create function public.admin_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare start_at timestamptz; end_at timestamptz; summary jsonb; recent jsonb; stock jsonb;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can view the dashboard.'; end if;
  start_at := ((now() at time zone 'America/Toronto')::date)::timestamp at time zone 'America/Toronto';
  end_at := (((now() at time zone 'America/Toronto')::date + 1)::timestamp) at time zone 'America/Toronto';
  select jsonb_build_object('ordersToday', count(*),
    'pendingOrders', count(*) filter(where status::text in ('SUBMITTED', 'PREPARING')),
    'revenueToday', coalesce(sum(final_total_amount) filter(where status::text = 'COMPLETED'), 0))
  into summary from public.orders where created_at >= start_at and created_at < end_at;
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into recent from (
    select to_jsonb(o) || jsonb_build_object('locations', jsonb_build_object('name', l.name)) as row_data
    from public.orders o left join public.locations l on l.id = o.location_id
    where o.created_at >= start_at and o.created_at < end_at order by o.created_at desc, o.id limit 5
  ) latest;
  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into stock from (
    select to_jsonb(c) as row_data from public.catalog_items c
    where c.is_active = true and (coalesce(c.available_stock, 0) <= 0 or c.available_stock < coalesce(c.low_stock_threshold, 20))
    order by c.available_stock, c.id limit 6
  ) low;
  return summary || jsonb_build_object('recentOrders', recent, 'lowItems', stock, 'businessDate', (now() at time zone 'America/Toronto')::date,
    'lowStock', (select count(*) from public.catalog_items where is_active = true and (coalesce(available_stock, 0) <= 0 or available_stock < coalesce(low_stock_threshold, 20))));
end;
$$;
revoke all on function public.save_daily_stock(jsonb) from public, anon;
revoke all on function public.admin_order_counts(date, date, uuid) from public, anon;
revoke all on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.save_daily_stock(jsonb), public.admin_order_counts(date, date, uuid), public.admin_dashboard_summary() to authenticated;
commit;
