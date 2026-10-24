begin;
-- Staff can manage bookings only for their assigned branch; other role policies remain intact.
drop policy if exists branch_employee_catering on public.catering_events;
create policy branch_employee_catering on public.catering_events for all to authenticated
using(location_id=public.inventory_location() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='BRANCH_EMPLOYEE' and p.status::text='active'))
with check(location_id=public.inventory_location() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='BRANCH_EMPLOYEE' and p.status::text='active'));
notify pgrst,'reload schema';
commit;
