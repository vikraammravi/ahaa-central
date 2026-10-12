begin;
alter table public.branch_inventory_counts add column flow_version integer not null default 1,
 add column received_until timestamptz not null default clock_timestamp();
update public.branch_inventory_counts set received_until=submitted_at;
alter table public.branch_inventory_lines add column opening_quantity bigint check(opening_quantity>=0),
 add column received_quantity bigint check(received_quantity>=0), add column used_quantity integer check(used_quantity>=0),
 add column wasted_quantity integer check(wasted_quantity>=0), add column adjustment_quantity bigint;

-- Private calculation helper. Only scoped public RPCs can call it.
create function public.inventory_day_state(p_branch uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
  select c.id,c.name,c.unit_type,pl.id is null opening_editable,
   case when pl.id is not null then pl.quantity::bigint+coalesce(t.before_today,0)-coalesce(pl.received_quantity,t.previous_legacy_received,0) else coalesce(cl.opening_quantity,0) end opening,
   coalesce(t.received,0) received,cl.used_quantity used,cl.wasted_quantity wasted,cl.quantity recorded,
   case when cl.id is not null then cl.quantity::bigint+coalesce(t.received,0)-coalesce(cl.received_quantity,t.current_legacy_received,0) else null end counted_balance,
   cl.opening_quantity saved_opening,cl.received_quantity saved_received
  from public.catalog_items c left join public.branch_inventory_lines pl on pl.count_id=previous.id and pl.item_id=c.id
   left join public.branch_inventory_lines cl on cl.count_id=current_day.id and cl.item_id=c.id left join totals t on t.item_id=c.id
  where c.is_active is true or coalesce(pl.quantity,0)>0 or coalesce(cl.quantity,0)>0 or coalesce(t.received,0)>0
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit_type',unit_type,'opening_editable',opening_editable,'opening_quantity',opening,'received_quantity',received,
  'used_quantity',used,'wasted_quantity',wasted,'recorded_quantity',recorded,'quantity',coalesce(counted_balance,opening+received),
  'adjustment_quantity',case when recorded is null then 0 else coalesce(counted_balance,opening+received)-(opening+received-coalesce(used,0)-coalesce(wasted,0)) end,
  'needs_review',recorded is not null and (saved_opening is distinct from opening or saved_received is distinct from received)) order by name,id),'[]') into items from base;
 return jsonb_build_object('current',case when current_day.id is null then null else to_jsonb(current_day) end,'previous',case when previous.id is null then null else to_jsonb(previous) end,'items',items);
end; $$;
revoke all on function public.inventory_day_state(uuid,date) from public,anon,authenticated;

create or replace function public.branch_inventory_workspace(p_count_date date default (now() at time zone 'America/Toronto')::date,p_location_id uuid default null,p_history_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare branch uuid; state jsonb; history jsonb; total integer; today date:=(now() at time zone 'America/Toronto')::date;
begin
 if public."current_role"()='CENTRAL_ADMIN' then branch:=p_location_id;else branch:=public.inventory_location();if p_location_id is not null and p_location_id is distinct from branch then raise exception 'Inventory not accessible.';end if;end if;
 if branch is null or not exists(select 1 from public.locations where id=branch and is_central is not true) then raise exception 'Choose an assigned branch.';end if;
 if p_count_date is null or p_count_date>today or p_history_page is null or p_history_page<0 then raise exception 'Choose a valid inventory date and page.';end if;
 state:=public.inventory_day_state(branch,p_count_date);
 select count(*) into total from public.branch_inventory_counts where location_id=branch and count_date<=p_count_date;
 select coalesce(jsonb_agg(to_jsonb(h)),'[]') into history from (select id,count_date,submitted_at,submitted_name,notes,flow_version from public.branch_inventory_counts where location_id=branch and count_date<=p_count_date order by count_date desc,submitted_at desc,id desc limit 25 offset p_history_page*25) h;
 return jsonb_build_object('location_id',branch,'branch_name',(select name from public.locations where id=branch),'today',today,'count_date',p_count_date,
  'expected_count_id',state->'current'->'id','expected_previous_count_id',state->'previous'->'id','previous_date',state->'previous'->'count_date',
  'latest',coalesce(nullif(state->'current','null'),state->'previous'),'current',state->'current','items',state->'items','history',history,'history_total',total);
end; $$;

create function public.save_branch_inventory_day(p_count_date date,p_lines jsonb,p_notes text default '',p_expected_count_id uuid default null,p_expected_previous_count_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; branch uuid; state jsonb; base jsonb; input jsonb; field text; val numeric; opening bigint; received bigint; used integer; wasted integer; closing integer; adjustment bigint; result uuid; expected integer; cutoff timestamptz;
begin
 select * into actor from public.profiles where id=auth.uid();branch:=public.inventory_location();
 if actor.status::text is distinct from 'active' or actor.role::text not in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') or branch is null then raise exception 'Only an active branch manager or employee can update inventory.';end if;
 if p_count_date is null or p_count_date>(clock_timestamp() at time zone 'America/Toronto')::date then raise exception 'Choose today or an earlier inventory date.';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Notes must be 2000 characters or fewer.';end if;
 perform pg_advisory_xact_lock(hashtextextended(branch::text,0));
 lock table public.catalog_items in share mode;
 state:=public.inventory_day_state(branch,p_count_date);
 if (state->'current'->>'id')::uuid is distinct from p_expected_count_id or (state->'previous'->>'id')::uuid is distinct from p_expected_previous_count_id then raise exception 'Inventory changed. Reload and review the latest record before saving.';end if;
 if exists(select 1 from public.pickup_requests r join public.orders o on o.id=r.order_id where o.location_id=branch and r.requested_at<(p_count_date+1)::timestamp at time zone 'America/Toronto' and ((r.status='PENDING' and r.already_collected) or r.return_status='PENDING')) then raise exception 'Resolve already-collected pickup approvals or outstanding returns before updating inventory.';end if;
 expected:=jsonb_array_length(state->'items');
 if expected=0 or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)<>expected or (select count(distinct value->>'item_id') from jsonb_array_elements(p_lines))<>expected then raise exception 'Enter every inventory item once. Reload if the catalog changed.';end if;
 cutoff:=least(clock_timestamp(),(p_count_date+1)::timestamp at time zone 'America/Toronto');
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,notes,flow_version,received_until) values(branch,p_count_date,actor.id,actor.full_name,coalesce(trim(p_notes),''),2,cutoff) returning id into result;
 for base in select value from jsonb_array_elements(state->'items') loop
  select value into input from jsonb_array_elements(p_lines) where value->>'item_id'=base->>'id';
  if input is null then raise exception 'An inventory item is missing.';end if;
  foreach field in array array['opening_quantity','used_quantity','wasted_quantity','quantity','expected_opening_quantity','expected_received_quantity'] loop
   if jsonb_typeof(input->field) is distinct from 'number' then raise exception 'Enter whole-unit quantities for every item.';end if;
   val:=(input->>field)::numeric;if val<0 or val>2147483647 or val<>trunc(val) then raise exception 'Inventory quantities must be nonnegative whole units.';end if;
  end loop;
  if (input->>'expected_opening_quantity')::bigint is distinct from (base->>'opening_quantity')::bigint or (input->>'expected_received_quantity')::bigint is distinct from (base->>'received_quantity')::bigint then raise exception 'Opening stock or completed pickups changed. Reload before saving.';end if;
  opening:=(input->>'opening_quantity')::bigint;received:=(base->>'received_quantity')::bigint;used:=(input->>'used_quantity')::integer;wasted:=(input->>'wasted_quantity')::integer;closing:=(input->>'quantity')::integer;
  if not (base->>'opening_editable')::boolean and opening is distinct from (base->>'opening_quantity')::bigint then raise exception 'Opening stock comes from the previous closing record.';end if;
  adjustment:=closing-(opening+received-used-wasted);
  if adjustment<>0 and coalesce(trim(p_notes),'')='' then raise exception 'Add a note explaining the difference from calculated closing stock.';end if;
  insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,opening_quantity,received_quantity,used_quantity,wasted_quantity,adjustment_quantity)
  values(result,(base->>'id')::uuid,base->>'name',base->>'unit_type',closing,opening,received,used,wasted,adjustment);
 end loop;
 return result;
end; $$;
revoke all on function public.save_branch_inventory_day(date,jsonb,text,uuid,uuid) from public,anon;
grant execute on function public.save_branch_inventory_day(date,jsonb,text,uuid,uuid) to authenticated;
drop function public.submit_branch_inventory(date,jsonb,text,uuid);
commit;
