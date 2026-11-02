begin;
-- Same admin operation as line editing, committed as one transaction.
create function public.save_order_fulfillment(p_order_id uuid,p_lines jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare parent public.orders%rowtype; current_line public.order_lines%rowtype; input jsonb; qty integer;
begin
 if public.current_role() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can save fulfillment.'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'Choose valid fulfillment changes.'; end if;
 select * into parent from public.orders where id=p_order_id for update;
 if not found or parent.status::text not in ('SUBMITTED','PREPARING') then raise exception 'Only Submitted or Preparing orders can be edited. Refresh this order.'; end if;
 if (select count(distinct value->>'line_id') from jsonb_array_elements(p_lines)) <> jsonb_array_length(p_lines) then raise exception 'Duplicate or missing order lines.'; end if;
 perform 1 from public.order_lines where order_id=p_order_id order by id for update;
 for input in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(input) is distinct from 'object' or coalesce(input->>'quantity','') !~ '^[0-9]+$' or coalesce(input->>'expected_quantity','') !~ '^[0-9]+$' or length(coalesce(input->>'note',''))>10000 then raise exception 'Use valid whole quantities and notes.'; end if;
  select * into current_line from public.order_lines where id=(input->>'line_id')::uuid and order_id=p_order_id;
  if not found then raise exception 'An order line is no longer available. Refresh this order.'; end if;
  qty:=(input->>'quantity')::integer;
  if qty>current_line.quantity then raise exception 'Fulfillment cannot exceed the ordered quantity.'; end if;
  if current_line.fulfilled_quantity is distinct from (input->>'expected_quantity')::integer or coalesce(current_line.shortage_reason,'') is distinct from coalesce(input->>'expected_note','') then raise exception 'This order was changed by another user. Refresh before saving.'; end if;
  update public.order_lines set fulfilled_quantity=qty,shortage_reason=nullif(trim(input->>'note'),'') where id=current_line.id;
 end loop;
end;
$$;
revoke all on function public.save_order_fulfillment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_order_fulfillment(uuid,jsonb) to authenticated;

-- Bounded recent lists; counts stay in Postgres instead of downloading history.
create function public.branch_dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare branch uuid; day_start timestamptz := date_trunc('day',now() at time zone 'America/Toronto') at time zone 'America/Toronto'; day_end timestamptz := (date_trunc('day',now() at time zone 'America/Toronto')+interval '1 day') at time zone 'America/Toronto';
begin
 if public.current_role() is distinct from 'BRANCH_MANAGER' then raise exception 'Only an active branch manager can view this dashboard.'; end if;
 branch:=public.current_location();
 if branch is null then raise exception 'No branch is assigned to this account.'; end if;
 return jsonb_build_object(
  'branch',(select jsonb_build_object('id',l.id,'name',l.name) from public.locations l where l.id=branch),
  'businessDate',to_char(now() at time zone 'America/Toronto','YYYY-MM-DD'),
  'todaysOrder',(select jsonb_build_object('final_total_amount',o.final_total_amount) from public.orders o where o.location_id=branch and o.created_at>=day_start and o.created_at<day_end order by o.created_at desc,o.id limit 1),
  'pendingOrders',(select count(*) from public.orders o where o.location_id=branch and o.status::text in ('SUBMITTED','PREPARING')),
  'recentOrders',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from (select id,order_number,created_at,final_total_amount,status from public.orders where location_id=branch order by created_at desc,id limit 5) r),'[]'::jsonb),
  'upcomingCateringCount',(select count(*) from public.catering_events c where c.location_id=branch and c.event_datetime>=day_start and c.status::text not in ('CANCELLED','COMPLETED')),
  'upcomingCatering',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_datetime,r.id) from (select id,customer_name,event_datetime,guest_count,total_amount from public.catering_events where location_id=branch and event_datetime>=day_start and status::text not in ('CANCELLED','COMPLETED') order by event_datetime,id limit 5) r),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.branch_dashboard_summary() from public,anon,authenticated;
grant execute on function public.branch_dashboard_summary() to authenticated;
commit;
