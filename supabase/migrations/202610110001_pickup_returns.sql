begin;
alter table public.pickup_requests
  add column already_collected boolean not null default false,
  add column return_status text check (return_status in ('PENDING','RECEIVED')),
  add column return_received_at timestamptz,
  add column return_received_by uuid references public.profiles(id),
  add column return_note text;
alter table public.pickup_request_lines
  add column extra_stock_debited integer not null default 0,
  add column allocation_shortfall integer not null default 0,
  add column return_quantity integer not null default 0;
alter table public.orders add column pickup_confirmed_by uuid references public.profiles(id), add column pickup_confirmed_at timestamptz;

-- Preserve the old RPC signature for callers, but allow an explicit collected flag.
drop function public.submit_pickup(uuid,jsonb,text);
create function public.submit_pickup(p_order_id uuid,p_quantities jsonb,p_reason text default '',p_already_collected boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; target public.orders%rowtype; line record; proposal jsonb; qty numeric;
  changes boolean:=false; total integer; request_id uuid; extra integer; debited integer; available integer;
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.status::text<>'active' or actor.role::text not in ('CENTRAL_ADMIN','BRANCH_MANAGER') then raise exception 'An active admin or branch manager is required.'; end if;
  select * into target from public.orders where id=p_order_id for update;
  if not found or (actor.role::text='BRANCH_MANAGER' and target.location_id is distinct from actor.location_id) then raise exception 'Order not accessible.'; end if;
  if target.status::text is distinct from 'READY' or target.stock_deducted_at is null then raise exception 'Order is not Ready for pickup.'; end if;
  if target.pickup_approval_status='PENDING' or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Resolve the pending approval or return first.'; end if;
  if jsonb_typeof(p_quantities) is distinct from 'array' then raise exception 'Provide pickup quantities.'; end if;
  select count(*) into total from public.order_lines where order_id=target.id;
  if total=0 or jsonb_array_length(p_quantities)<>total or (select count(distinct value->>'line_id') from jsonb_array_elements(p_quantities))<>total then raise exception 'Provide each order line once.'; end if;
  for line in select * from public.order_lines where order_id=target.id order by item_id,id for update loop
    select value into proposal from jsonb_array_elements(p_quantities) where value->>'line_id'=line.id::text;
    if proposal is null or jsonb_typeof(proposal->'quantity') is distinct from 'number' then raise exception 'Invalid pickup quantity.'; end if;
    qty:=(proposal->>'quantity')::numeric;
    if qty<0 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Pickup quantity must be a nonnegative whole number.'; end if;
    changes:=changes or qty<>line.fulfilled_quantity;
  end loop;
  if not changes then
    update public.orders set status='COMPLETED',pickup_approval_status=null,pickup_confirmed_by=actor.id,pickup_confirmed_at=now(),updated_at=clock_timestamp() where id=target.id;
    return 'COMPLETED';
  end if;
  insert into public.pickup_requests(order_id,reason,requested_by,already_collected) values(target.id,coalesce(trim(p_reason),''),actor.id,coalesce(p_already_collected,false)) returning id into request_id;
  for line in select * from public.order_lines where order_id=target.id order by item_id,id loop
    select value into proposal from jsonb_array_elements(p_quantities) where value->>'line_id'=line.id::text;
    qty:=(proposal->>'quantity')::integer; extra:=greatest(qty::integer-line.fulfilled_quantity,0); debited:=0;
    if p_already_collected and extra>0 then
      select available_stock into available from public.catalog_items where id=line.item_id for update;
      debited:=least(extra,greatest(coalesce(available,0),0));
      update public.catalog_items set available_stock=available_stock-debited,updated_at=clock_timestamp() where id=line.item_id;
    end if;
    insert into public.pickup_request_lines(request_id,order_line_id,item_id,prepared_quantity,pickup_quantity,extra_stock_debited,allocation_shortfall)
    values(request_id,line.id,line.item_id,line.fulfilled_quantity,qty::integer,debited,case when p_already_collected then extra-debited else 0 end);
  end loop;
  update public.orders set pickup_approval_status='PENDING',updated_at=clock_timestamp() where id=target.id;
  return 'PENDING';
end; $$;

create or replace function public.review_pickup(p_request_id uuid,p_approve boolean,p_note text default '',p_returns jsonb default '{}')
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target_id uuid; target public.orders%rowtype; request public.pickup_requests%rowtype; line record; available integer; delta integer; usable boolean; needs_return boolean;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can review pickup.'; end if;
  select order_id into target_id from public.pickup_requests where id=p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  select * into target from public.orders where id=target_id for update;
  select * into request from public.pickup_requests where id=p_request_id for update;
  if request.status<>'PENDING' or target.status::text is distinct from 'READY' or target.pickup_approval_status is distinct from 'PENDING' or p_approve is null then raise exception 'Request is no longer pending.'; end if;
  if not p_approve then
    needs_return:=request.already_collected and exists(select 1 from public.pickup_request_lines where request_id=request.id and pickup_quantity>prepared_quantity);
    update public.pickup_request_lines set return_quantity=greatest(pickup_quantity-prepared_quantity,0) where request_id=request.id and needs_return;
    update public.pickup_requests set status='REJECTED',reviewed_by=actor,reviewed_at=now(),review_note=nullif(trim(p_note),''),return_status=case when needs_return then 'PENDING' else null end where id=request.id;
    update public.orders set pickup_approval_status='REJECTED',updated_at=clock_timestamp() where id=target.id;
    return case when needs_return then 'RETURN_PENDING' else 'REJECTED' end;
  end if;
  if request.already_collected and exists(select 1 from public.pickup_request_lines where request_id=request.id and allocation_shortfall>0) then raise exception 'These extras used stock allocated elsewhere. Reject the request to arrange their return.'; end if;
  for line in select r.*,l.fulfilled_quantity from public.pickup_request_lines r join public.order_lines l on l.id=r.order_line_id where r.request_id=request.id order by r.item_id,r.id for update of l loop
    if line.fulfilled_quantity<>line.prepared_quantity then raise exception 'Prepared quantities changed. Reload the request.'; end if;
    delta:=line.prepared_quantity-line.pickup_quantity; usable:=null;
    if delta>0 then
      if jsonb_typeof(p_returns->line.order_line_id::text) is distinct from 'boolean' then raise exception 'Choose what happens to every reduced quantity.'; end if;
      usable:=(p_returns->>line.order_line_id::text)::boolean;
      if not usable then delta:=0; end if;
    elsif request.already_collected then delta:=0;
    end if;
    select available_stock into available from public.catalog_items where id=line.item_id for update;
    if available is null or available+delta<0 then raise exception 'Insufficient stock for extra pickup.'; end if;
    update public.catalog_items set available_stock=available_stock+delta,updated_at=clock_timestamp() where id=line.item_id;
    update public.pickup_request_lines set return_to_stock=usable,stock_adjustment=delta-extra_stock_debited where id=line.id;
    update public.order_lines set fulfilled_quantity=line.pickup_quantity where id=line.order_line_id;
  end loop;
  update public.pickup_requests set status='APPROVED',reviewed_by=actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=request.id;
  update public.orders set status='COMPLETED',pickup_approval_status='APPROVED',pickup_confirmed_by=actor,pickup_confirmed_at=now(),updated_at=clock_timestamp() where id=target.id;
  return 'APPROVED';
end; $$;

create function public.receive_pickup_return(p_request_id uuid,p_note text default '') returns text language plpgsql security definer set search_path='' as $$
declare target_id uuid; request public.pickup_requests%rowtype; line record;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can confirm returns.'; end if;
  select order_id into target_id from public.pickup_requests where id=p_request_id;
  perform 1 from public.orders where id=target_id for update;
  select * into request from public.pickup_requests where id=p_request_id for update;
  if not found or request.return_status is distinct from 'PENDING' then raise exception 'Return is no longer pending.'; end if;
  for line in select * from public.pickup_request_lines where request_id=request.id and return_quantity>0 order by item_id,id loop
    -- Returned allocated stock fills the shortfall; only previously debited
    -- unallocated stock is credited to available inventory.
    update public.catalog_items set available_stock=available_stock+line.extra_stock_debited,updated_at=clock_timestamp() where id=line.item_id;
  end loop;
  update public.pickup_requests set return_status='RECEIVED',return_received_at=now(),return_received_by=auth.uid(),return_note=nullif(trim(p_note),'') where id=request.id;
  update public.orders set status='COMPLETED',pickup_confirmed_by=auth.uid(),pickup_confirmed_at=now(),updated_at=clock_timestamp() where id=target_id;
  return 'RECEIVED';
end; $$;
revoke all on function public.submit_pickup(uuid,jsonb,text,boolean),public.receive_pickup_return(uuid,text) from public,anon;
grant execute on function public.submit_pickup(uuid,jsonb,text,boolean),public.receive_pickup_return(uuid,text) to authenticated;
commit;
