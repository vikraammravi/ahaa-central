-- Enforce the order lifecycle for direct client writes:
--   SUBMITTED -> PREPARING -> READY, and SUBMITTED/PREPARING -> CANCELLED.
-- Completion stays with the pickup/approval functions (security definer, so
-- they run as the function owner and are not checked here). Existing guards
-- already block completion and post-deduction resets; this adds the missing
-- cases: cancelling after stock was deducted (stock would be lost), reopening
-- Completed or Cancelled orders, skipping Preparing, and moving backwards.
-- No data is changed. Existing orders keep their current status.
begin;

create function public.guard_order_status_transition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.status is distinct from old.status
     and (old.status::text, new.status::text) not in (
       ('SUBMITTED', 'PREPARING'),
       ('PREPARING', 'READY'),
       ('SUBMITTED', 'CANCELLED'),
       ('PREPARING', 'CANCELLED'),
       -- Rejected later by orders_guard_pickup with its own message.
       ('READY', 'COMPLETED')
     ) then
    raise exception 'Order status cannot change from % to %.',
      initcap(old.status::text), initcap(new.status::text);
  end if;
  return new;
end;
$$;
revoke all on function public.guard_order_status_transition() from public, anon, authenticated;

create trigger orders_guard_status_transition before update of status on public.orders
for each row execute function public.guard_order_status_transition();

commit;
