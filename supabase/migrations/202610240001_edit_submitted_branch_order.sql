begin;

create or replace function public.edit_submitted_branch_order(p_order_id uuid,p_quantities jsonb,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; target public.orders%rowtype; entry jsonb; product public.catalog_items%rowtype; existing public.order_lines%rowtype; qty numeric; price numeric; taxable boolean; sub numeric; tax numeric;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.status::text is distinct from 'active' or actor.role::text is distinct from 'BRANCH_MANAGER' or actor.location_id is null then raise exception 'Only an active branch manager can edit a submitted order.';end if;
 select * into target from public.orders where id=p_order_id and location_id=actor.location_id for update;
 if not found then raise exception 'Order not found for your branch.';end if;
 if target.status::text is distinct from 'SUBMITTED' or target.weekly_invoice_id is not null or target.stock_deducted_at is not null or target.pickup_approval_status is not null then raise exception 'Only Submitted orders can be edited. Central kitchen may have started preparing this order.';end if;
 if target.updated_at is distinct from p_expected_updated_at then raise exception 'This order changed. Reload it before making changes.';end if;
 if jsonb_typeof(p_quantities) is distinct from 'array' or jsonb_array_length(p_quantities)=0 then raise exception 'Select at least one item.';end if;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(p_quantities))<>jsonb_array_length(p_quantities) then raise exception 'Select each item once.';end if;
 -- Match the order-then-product lock order used when an order becomes Ready.
 perform 1 from public.catalog_items where id in (select (value->>'item_id')::uuid from jsonb_array_elements(p_quantities)) order by id for share;
 for entry in select value from jsonb_array_elements(p_quantities) loop
  if jsonb_typeof(entry->'quantity') is distinct from 'number' then raise exception 'Enter whole-unit quantities.';end if;
  qty:=(entry->>'quantity')::numeric;
  if qty<1 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Quantities must be positive whole units.';end if;
  select * into product from public.catalog_items where id=(entry->>'item_id')::uuid;
  if not found or product.is_active is not true or qty>coalesce(product.available_stock,0) then raise exception 'An item is unavailable or exceeds central stock. Review the latest catalog.';end if;
 end loop;
 delete from public.order_lines where order_id=p_order_id and item_id not in (select (value->>'item_id')::uuid from jsonb_array_elements(p_quantities));
 for entry in select value from jsonb_array_elements(p_quantities) loop
  qty:=(entry->>'quantity')::numeric;
  select * into existing from public.order_lines where order_id=p_order_id and item_id=(entry->>'item_id')::uuid;
  if found then
   update public.order_lines set quantity=qty::integer,fulfilled_quantity=qty::integer,line_total=qty*existing.unit_price where id=existing.id;
  else
   select * into product from public.catalog_items where id=(entry->>'item_id')::uuid;
   price:=product.default_price;taxable:=coalesce(product.is_taxable,false);
   insert into public.order_lines(order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total) values(p_order_id,product.id,qty::integer,qty::integer,price,taxable,qty*price);
  end if;
 end loop;
 select round(coalesce(sum(line_total),0),2),round(coalesce(sum(case when is_taxable then line_total*0.13 else 0 end),0),2) into sub,tax from public.order_lines where order_id=p_order_id;
 update public.orders set subtotal=sub,tax_amount=tax,total_amount=sub+tax,updated_at=clock_timestamp() where id=p_order_id;
 return p_order_id;
end; $$;
revoke all on function public.edit_submitted_branch_order(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.edit_submitted_branch_order(uuid,jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
