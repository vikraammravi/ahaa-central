begin;
create or replace function public.inventory_day_state(p_branch uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare previous public.branch_inventory_counts%rowtype; current_day public.branch_inventory_counts%rowtype; items jsonb; day_start timestamptz:=p_date::timestamp at time zone 'America/Toronto'; day_end timestamptz:=(p_date+1)::timestamp at time zone 'America/Toronto';
begin
 select * into previous from public.branch_inventory_counts where location_id=p_branch and count_date<p_date order by count_date desc,submitted_at desc,id desc limit 1;
 select * into current_day from public.branch_inventory_counts where location_id=p_branch and count_date=p_date order by submitted_at desc,id desc limit 1;
 with receipts as (
  select l.item_id,l.fulfilled_quantity::bigint qty,coalesce(o.pickup_confirmed_at,o.updated_at,o.created_at) stamp from public.orders o join public.order_lines l on l.order_id=o.id
  where o.location_id=p_branch and o.status::text='COMPLETED' and o.pickup_approval_status is distinct from 'PENDING' and not exists(select 1 from public.pickup_requests r where r.order_id=o.id and r.return_status='PENDING')
 ), totals as (
  select item_id,coalesce(sum(qty) filter(where stamp>=day_start and stamp<day_end and stamp<=now()),0)::bigint received,
   coalesce(sum(qty) filter(where stamp>=previous.count_date::timestamp at time zone 'America/Toronto' and stamp<day_start),0)::bigint before_today,
   coalesce(sum(qty) filter(where stamp>=previous.count_date::timestamp at time zone 'America/Toronto' and stamp<=previous.received_until),0)::bigint previous_legacy_received,
   coalesce(sum(qty) filter(where stamp>=day_start and stamp<day_end and stamp<=current_day.received_until),0)::bigint current_legacy_received
  from receipts group by item_id
 ), base as (
  select c.id,c.name,c.category,c.unit_type,pl.id is null opening_editable,
   case when pl.id is not null then pl.quantity::bigint+coalesce(t.before_today,0)-coalesce(pl.received_quantity,t.previous_legacy_received,0) else coalesce(cl.opening_quantity,0) end opening,
   coalesce(t.received,0) received,cl.used_quantity used,cl.wasted_quantity wasted,cl.quantity recorded,
   case when cl.id is not null then cl.quantity::bigint+coalesce(t.received,0)-coalesce(cl.received_quantity,t.current_legacy_received,0) else null end counted_balance,
   cl.opening_quantity saved_opening,cl.received_quantity saved_received
  from public.catalog_items c left join public.branch_inventory_lines pl on pl.count_id=previous.id and pl.item_id=c.id
   left join public.branch_inventory_lines cl on cl.count_id=current_day.id and cl.item_id=c.id left join totals t on t.item_id=c.id
  where c.is_active is true or coalesce(pl.quantity,0)>0 or coalesce(cl.quantity,0)>0 or coalesce(t.received,0)>0
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,'unit_type',unit_type,'opening_editable',opening_editable,'opening_quantity',opening,'received_quantity',received,
  'used_quantity',used,'wasted_quantity',wasted,'recorded_quantity',recorded,'quantity',coalesce(counted_balance,opening+received),
  'adjustment_quantity',case when recorded is null then 0 else coalesce(counted_balance,opening+received)-(opening+received-coalesce(used,0)-coalesce(wasted,0)) end,
  'needs_review',recorded is not null and (saved_opening is distinct from opening or saved_received is distinct from received)) order by name,id),'[]') into items from base;
 return jsonb_build_object('current',case when current_day.id is null then null else to_jsonb(current_day) end,'previous',case when previous.id is null then null else to_jsonb(previous) end,'items',items);
end; $$;
revoke all on function public.inventory_day_state(uuid,date) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
