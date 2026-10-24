begin;

create or replace function public.create_branch_order(p_order_id uuid,p_quantities jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; previous public.orders%rowtype; product public.catalog_items%rowtype; entry jsonb; qty numeric; subtotal numeric:=0; tax numeric:=0; expected jsonb; actual jsonb;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.status::text is distinct from 'active' or actor.role::text is distinct from 'BRANCH_MANAGER' or actor.location_id is null then raise exception 'Only an active branch manager can place an order.';end if;
 if p_order_id is null or jsonb_typeof(p_quantities) is distinct from 'array' or jsonb_array_length(p_quantities)=0 then raise exception 'Select at least one item.';end if;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(p_quantities))<>jsonb_array_length(p_quantities) then raise exception 'Select each item once.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text,0));
 select * into previous from public.orders where id=p_order_id;
 if found then
  if previous.created_by is distinct from actor.id or previous.location_id is distinct from actor.location_id then raise exception 'This order identifier is unavailable.';end if;
  select jsonb_agg(jsonb_build_object('item_id',value->>'item_id','quantity',(value->>'quantity')::numeric) order by value->>'item_id') into expected from jsonb_array_elements(p_quantities);
  select jsonb_agg(jsonb_build_object('item_id',item_id::text,'quantity',quantity) order by item_id::text) into actual from public.order_lines where order_id=p_order_id;
  if actual is distinct from expected then raise exception 'This order was already submitted. Open Orders before making further changes.';end if;
  return p_order_id;
 end if;
 perform 1 from public.catalog_items where id in(select (value->>'item_id')::uuid from jsonb_array_elements(p_quantities)) order by id for share;
 for entry in select value from jsonb_array_elements(p_quantities) loop
  if jsonb_typeof(entry->'quantity') is distinct from 'number' then raise exception 'Enter positive whole-unit quantities.';end if;
  qty:=(entry->>'quantity')::numeric;
  if qty<1 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Enter positive whole-unit quantities.';end if;
  select * into product from public.catalog_items where id=(entry->>'item_id')::uuid;
  if not found or product.is_active is not true or qty>coalesce(product.available_stock,0) then raise exception 'An item is unavailable or exceeds central stock. Review the latest catalog.';end if;
  subtotal:=subtotal+qty*product.default_price;
  if product.is_taxable then tax:=tax+qty*product.default_price*0.13;end if;
 end loop;
 insert into public.orders(id,location_id,status,created_by,subtotal,tax_amount,total_amount)
 values(p_order_id,actor.location_id,'SUBMITTED',actor.id,round(subtotal,2),round(tax,2),round(subtotal,2)+round(tax,2));
 for entry in select value from jsonb_array_elements(p_quantities) loop
  select * into product from public.catalog_items where id=(entry->>'item_id')::uuid;
  qty:=(entry->>'quantity')::numeric;
  insert into public.order_lines(order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total)
  values(p_order_id,product.id,qty::integer,qty::integer,product.default_price,coalesce(product.is_taxable,false),qty*product.default_price);
 end loop;
 return p_order_id;
end; $$;
revoke all on function public.create_branch_order(uuid,jsonb) from public,anon;
grant execute on function public.create_branch_order(uuid,jsonb) to authenticated;

-- Completion runs separately from list reads and is restricted to the actor's location.
create or replace function public.complete_past_catering_events(p_location_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; changed integer;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.status::text is distinct from 'active' then raise exception 'An active account is required.';end if;
 if actor.role::text='CENTRAL_ADMIN' then
  if not exists(select 1 from public.locations where id=p_location_id and is_central) then raise exception 'Choose the central kitchen location.';end if;
 elsif actor.role::text not in('BRANCH_MANAGER','BRANCH_EMPLOYEE') or actor.location_id is distinct from p_location_id then raise exception 'This location is not available for your account.';
 end if;
 update public.catering_events set status='COMPLETED',updated_at=clock_timestamp()
 where location_id=p_location_id and status::text='CONFIRMED' and event_datetime<date_trunc('day',now() at time zone 'America/Toronto') at time zone 'America/Toronto';
 get diagnostics changed=row_count;return changed;
end; $$;
revoke all on function public.complete_past_catering_events(uuid) from public,anon;
grant execute on function public.complete_past_catering_events(uuid) to authenticated;

create or replace function public.normalize_catering_status() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status::text='CONFIRMED' and (new.event_datetime at time zone 'America/Toronto')::date<(now() at time zone 'America/Toronto')::date then new.status:='COMPLETED';end if;
 return new;
end; $$;
drop trigger if exists normalize_catering_status on public.catering_events;
create trigger normalize_catering_status before insert or update of status,event_datetime on public.catering_events for each row execute function public.normalize_catering_status();
create index if not exists catering_location_status_date on public.catering_events(location_id,status,event_datetime,id);
notify pgrst,'reload schema';
commit;
