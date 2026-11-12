-- Install before deploying the checked invoice-preview UI.
-- The existing combine routine remains available to older clients.
begin;
grant create on schema public to ahaa_operations;

create function public.create_weekly_invoice_checked(
 p_location_id uuid, p_start_date date, p_end_date date,
 p_order_ids uuid[], p_expected jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare target public.orders%rowtype; expected jsonb; total integer := 0;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can create weekly invoices.'; end if;
 if coalesce(cardinality(p_order_ids),0)=0 or jsonb_typeof(p_expected) is distinct from 'array'
    or jsonb_array_length(p_expected) <> cardinality(p_order_ids)
    or cardinality(p_order_ids) <> (select count(distinct id) from unnest(p_order_ids) id)
    or cardinality(p_order_ids) <> (select count(distinct value->>'id') from jsonb_array_elements(p_expected)) then
   raise exception 'Review the selected invoices again.';
 end if;
 -- Lock in the same deterministic order as the underlying combine and invoice editor.
 for target in select * from public.orders where id=any(p_order_ids) order by id for update loop
   total := total + 1;
   select value into expected from jsonb_array_elements(p_expected) where value->>'id'=target.id::text;
   if expected is null or expected->>'updated_at' is null
      or target.updated_at is distinct from (expected->>'updated_at')::timestamptz
      or target.order_date is distinct from (expected->>'order_date')::date
      or target.final_subtotal is distinct from (expected->>'final_subtotal')::numeric
      or target.final_tax_amount is distinct from (expected->>'final_tax_amount')::numeric
      or target.final_total_amount is distinct from (expected->>'final_total_amount')::numeric then
     raise exception 'These invoices changed. Close and review the updated amounts before combining.';
   end if;
 end loop;
 if total <> cardinality(p_order_ids) then raise exception 'One of the selected orders is unavailable.'; end if;
 return public.create_weekly_invoice(p_location_id,p_start_date,p_end_date,p_order_ids);
end; $$;
alter function public.create_weekly_invoice_checked(uuid,date,date,uuid[],jsonb) owner to ahaa_operations;
revoke all on function public.create_weekly_invoice_checked(uuid,date,date,uuid[],jsonb) from public,anon;
grant execute on function public.create_weekly_invoice_checked(uuid,date,date,uuid[],jsonb) to authenticated;
revoke create on schema public from ahaa_operations;
notify pgrst, 'reload schema';
commit;
