begin;

grant create on schema public to ahaa_operations;

alter table public.orders add column pickup_date date;
alter table public.pickup_requests add column pickup_date date;

create function public.guard_pickup_date() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and
     ((tg_op = 'INSERT' and new.pickup_date is not null) or
      (tg_op = 'UPDATE' and new.pickup_date is distinct from old.pickup_date)) then
    raise exception 'Use the pickup workflow to set the pickup date.';
  end if;
  return new;
end; $$;
create trigger guard_order_pickup_date before insert or update on public.orders
  for each row execute function public.guard_pickup_date();
create trigger guard_request_pickup_date before insert or update on public.pickup_requests
  for each row execute function public.guard_pickup_date();

-- The existing pickup operation remains responsible for authorization, stock,
-- approvals and locking. Store the business date in the same transaction.
create function public.submit_pickup_with_date(
  p_order_id uuid, p_quantities jsonb, p_reason text,
  p_already_collected boolean, p_pickup_date date
) returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if p_pickup_date is null or p_pickup_date > (now() at time zone 'America/Toronto')::date then
    raise exception 'Choose today or an earlier pickup date.';
  end if;
  result := public.submit_pickup(p_order_id, p_quantities, p_reason, p_already_collected);
  if result = 'COMPLETED' then
    update public.orders set pickup_date = p_pickup_date where id = p_order_id;
  elsif result = 'PENDING' then
    update public.pickup_requests set pickup_date = p_pickup_date
      where order_id = p_order_id and status = 'PENDING';
  else
    raise exception 'Unexpected pickup result.';
  end if;
  return result;
end; $$;
alter function public.submit_pickup_with_date(uuid,jsonb,text,boolean,date) owner to ahaa_operations;
revoke all on function public.submit_pickup_with_date(uuid,jsonb,text,boolean,date) from public, anon;
grant execute on function public.submit_pickup_with_date(uuid,jsonb,text,boolean,date) to authenticated;

create function public.apply_approved_pickup_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.status = 'APPROVED' or (new.status = 'REJECTED' and new.return_status = 'PENDING'))
     and old.status is distinct from new.status and new.pickup_date is not null then
    update public.orders set pickup_date = new.pickup_date where id = new.order_id;
  end if;
  return new;
end; $$;
alter function public.apply_approved_pickup_date() owner to ahaa_operations;
revoke all on function public.apply_approved_pickup_date() from public, anon, authenticated;
create trigger pickup_approval_date after update of status on public.pickup_requests
  for each row execute function public.apply_approved_pickup_date();

-- Preserve the installed tenant-scoped inventory function and its ownership.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef('public.inventory_day_state(uuid,date)'::regprocedure) into definition;
  updated := replace(definition,
    'coalesce(o.pickup_confirmed_at,o.updated_at,o.created_at)',
    'coalesce(o.pickup_date::timestamp at time zone ''America/Toronto'',o.pickup_confirmed_at,o.updated_at,o.created_at)');
  if updated = definition then raise exception 'Unexpected inventory function; pickup date migration stopped.'; end if;
  execute updated;
end; $$;

revoke create on schema public from ahaa_operations;
notify pgrst, 'reload schema';
commit;
