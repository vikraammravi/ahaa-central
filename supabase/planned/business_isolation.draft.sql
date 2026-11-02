-- INCOMPLETE DRAFT. NOT VALIDATED. DO NOT APPLY.
-- Requires workspace-aware APIs/UI, scoped receipt functions and full acceptance tests.
-- Paired with workspace-aware application code. STAGING FIRST.
-- Do not activate a second business until database AND server-path tests pass.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public,anon,authenticated;

create function public.current_business_id() returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare selected text; result uuid; choices integer;
begin
 if auth.uid() is null then return null; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and status::text='active') then return null; end if;
 selected=nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}')->>'x-business-id','');
 if selected is not null then
   if selected !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid workspace'; end if;
   select m.business_id into result from public.business_memberships m join public.businesses b on b.id=m.business_id
   where m.user_id=auth.uid() and m.business_id=selected::uuid and m.status::text='active' and b.status='active';
   if result is null then raise exception 'Workspace access is unavailable'; end if;
 else
   select count(*),(array_agg(m.business_id order by m.business_id))[1] into choices,result
   from public.business_memberships m join public.businesses b on b.id=m.business_id
   where m.user_id=auth.uid() and m.status::text='active' and b.status='active';
   if choices>1 then raise exception 'Choose a workspace'; end if;
 end if;
 return result;
end; $$;
revoke all on function public.current_business_id() from public,anon;
grant execute on function public.current_business_id() to authenticated,service_role;

-- A non-login function owner makes tenant RLS apply inside operational definers.
-- Keep privileged auth/context helpers outside this role to prevent policy recursion.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='ahaa_operations') then
   create role ahaa_operations nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='ahaa_operations' and (rolcanlogin or rolbypassrls or rolsuper)) then raise exception 'Unsafe operations role'; end if;
end; $$;
grant ahaa_operations to postgres;
grant usage on schema public,auth,app_private to ahaa_operations;
grant execute on function auth.uid() to ahaa_operations;
grant execute on function public.current_business_id() to ahaa_operations;

do $$
declare table_name text; original_business uuid;
begin
 select id into strict original_business from public.businesses where slug='ahaa';
 foreach table_name in array array['locations','catalog_categories','catalog_units','catalog_items','orders','order_lines',
 'pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','weekly_invoices',
 'weekly_invoice_publications','invoice_edits','catering_events','purchase_receipts'] loop
   execute format('alter table public.%I add column business_id uuid not null default %L::uuid',table_name,original_business);
   execute format('alter table public.%I alter column business_id set default public.current_business_id()',table_name);
   execute format('alter table public.%I add constraint %I foreign key(business_id) references public.businesses(id)',table_name,table_name||'_business_fk');
   execute format('create unique index %I on public.%I(business_id,id)',table_name||'_business_id_key',table_name);
   execute format('grant select,insert,update,delete on public.%I to ahaa_operations',table_name);
   execute format('create policy operations_internal on public.%I for all to ahaa_operations using(true) with check(true)',table_name);
   execute format('create policy business_boundary on public.%I as restrictive for all to authenticated,ahaa_operations using(business_id=(select public.current_business_id())) with check(business_id=(select public.current_business_id()))',table_name);
 end loop;
end; $$;
grant select on public.profiles,public.business_memberships,public.businesses to ahaa_operations;
grant usage,select on sequence public.stock_orders_order_number_seq to ahaa_operations;

-- Cross-business references fail independently of the caller's application checks.
alter table public.business_memberships drop constraint business_memberships_location_id_fkey;
alter table public.business_memberships add constraint business_memberships_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id) on delete set null (location_id);
alter table public.orders drop constraint stock_orders_location_id_fkey;
alter table public.orders add constraint stock_orders_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict;
alter table public.orders drop constraint orders_weekly_invoice_id_fkey;
alter table public.orders add constraint orders_weekly_invoice_id_fkey foreign key(business_id,weekly_invoice_id) references public.weekly_invoices(business_id,id);
alter table public.order_lines drop constraint stock_order_items_order_id_fkey;
alter table public.order_lines add constraint stock_order_items_order_id_fkey foreign key(business_id,order_id) references public.orders(business_id,id) on delete cascade;
alter table public.order_lines drop constraint stock_order_items_item_id_fkey;
alter table public.order_lines add constraint stock_order_items_item_id_fkey foreign key(business_id,item_id) references public.catalog_items(business_id,id) on delete restrict;
alter table public.pickup_requests drop constraint pickup_requests_order_id_fkey;
alter table public.pickup_requests add constraint pickup_requests_order_id_fkey foreign key(business_id,order_id) references public.orders(business_id,id);
alter table public.pickup_request_lines drop constraint pickup_request_lines_request_id_fkey;
alter table public.pickup_request_lines add constraint pickup_request_lines_request_id_fkey foreign key(business_id,request_id) references public.pickup_requests(business_id,id);
alter table public.pickup_request_lines drop constraint pickup_request_lines_order_line_id_fkey;
alter table public.pickup_request_lines add constraint pickup_request_lines_order_line_id_fkey foreign key(business_id,order_line_id) references public.order_lines(business_id,id);
alter table public.pickup_request_lines drop constraint pickup_request_lines_item_id_fkey;
alter table public.pickup_request_lines add constraint pickup_request_lines_item_id_fkey foreign key(business_id,item_id) references public.catalog_items(business_id,id);
alter table public.branch_inventory_counts drop constraint branch_inventory_counts_location_id_fkey;
alter table public.branch_inventory_counts add constraint branch_inventory_counts_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id);
alter table public.branch_inventory_lines drop constraint branch_inventory_lines_count_id_fkey;
alter table public.branch_inventory_lines add constraint branch_inventory_lines_count_id_fkey foreign key(business_id,count_id) references public.branch_inventory_counts(business_id,id);
alter table public.branch_inventory_lines drop constraint branch_inventory_lines_item_id_fkey;
alter table public.branch_inventory_lines add constraint branch_inventory_lines_item_id_fkey foreign key(business_id,item_id) references public.catalog_items(business_id,id);
alter table public.weekly_invoices drop constraint weekly_invoices_location_id_fkey;
alter table public.weekly_invoices add constraint weekly_invoices_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id);
alter table public.weekly_invoice_publications drop constraint weekly_invoice_publications_weekly_invoice_id_fkey;
alter table public.weekly_invoice_publications add constraint weekly_invoice_publications_weekly_invoice_id_fkey foreign key(business_id,weekly_invoice_id) references public.weekly_invoices(business_id,id);
alter table public.invoice_edits drop constraint invoice_edits_order_id_fkey;
alter table public.invoice_edits add constraint invoice_edits_order_id_fkey foreign key(business_id,order_id) references public.orders(business_id,id);
alter table public.catering_events drop constraint catering_events_location_id_fkey;
alter table public.catering_events add constraint catering_events_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id) on delete restrict;
alter table public.purchase_receipts drop constraint purchase_receipts_location_id_fkey;
alter table public.purchase_receipts add constraint purchase_receipts_location_id_fkey foreign key(business_id,location_id) references public.locations(business_id,id);

alter table public.catalog_items drop constraint catalog_category_option_fk,drop constraint catalog_unit_option_fk;
alter table public.catalog_categories drop constraint catalog_categories_name_key;
alter table public.catalog_units drop constraint catalog_units_name_key;
drop index if exists public.catalog_categories_name_ci;
drop index if exists public.catalog_units_lower_idx;
drop index if exists public.catalog_units_name_ci;
alter table public.catalog_categories add constraint category_business_name_key unique(business_id,name);
alter table public.catalog_units add constraint unit_business_name_key unique(business_id,name);
create unique index category_business_name_ci on public.catalog_categories(business_id,lower(name));
create unique index unit_business_name_ci on public.catalog_units(business_id,lower(name));
alter table public.catalog_items add constraint catalog_category_option_fk foreign key(business_id,category) references public.catalog_categories(business_id,name) on update cascade;
alter table public.catalog_items add constraint catalog_unit_option_fk foreign key(business_id,unit_type) references public.catalog_units(business_id,name) on update cascade;
alter table public.purchase_receipts drop constraint if exists purchase_receipts_file_hash_key;
drop index if exists public.purchase_receipts_scope_hash_idx;
create unique index purchase_receipts_business_scope_hash on public.purchase_receipts(business_id,coalesce(location_id,'00000000-0000-0000-0000-000000000000'::uuid),file_hash);

-- Profiles are global identity; role/location/status are membership-specific.
create view app_private.workspace_profiles as
select p.id,p.email,p.full_name,m.role,m.location_id,p.created_at,m.updated_at,m.status,p.phone
from public.profiles p join public.business_memberships m on m.user_id=p.id
where m.business_id=public.current_business_id();
grant usage on schema app_private to authenticated;
grant select on app_private.workspace_profiles to authenticated,ahaa_operations;

create or replace function public."current_role"() returns text
language sql stable security definer set search_path=''
as $$ select m.role::text from public.business_memberships m where m.user_id=auth.uid() and m.business_id=public.current_business_id() and m.status::text='active'; $$;
create or replace function public.current_location() returns uuid
language sql stable security definer set search_path=''
as $$ select m.location_id from public.business_memberships m where m.user_id=auth.uid() and m.business_id=public.current_business_id() and m.status::text='active' and m.role::text in ('CENTRAL_ADMIN','BRANCH_MANAGER'); $$;
create or replace function public.inventory_location() returns uuid
language sql stable security definer set search_path=''
as $$ select m.location_id from public.business_memberships m join public.locations l on l.id=m.location_id and l.business_id=m.business_id
where m.user_id=auth.uid() and m.business_id=public.current_business_id() and m.status::text='active' and m.role::text in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') and l.is_central is not true; $$;
grant execute on function public."current_role"(),public.current_location(),public.inventory_location() to ahaa_operations;
grant execute on function public.invoice_lines_snapshot(uuid) to ahaa_operations;

grant create on schema public to ahaa_operations;

-- Keep original transactional bodies and grants. Redirect actor reads to membership
-- projections; run operational SECURITY DEFINER functions as the restricted owner.
do $$
declare item record; definition text;
begin
 for item in select p.oid,p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and p.proname in (
 'admin_branch_stock','admin_dashboard_summary','admin_order_counts','branch_dashboard_summary','branch_inventory_workspace',
 'catalog_page','complete_past_catering_events','create_branch_order','create_weekly_invoice','deduct_stock_when_order_ready',
 'edit_invoice','edit_submitted_branch_order','guard_catalog_history_delete','inventory_day_state',
 'receive_pickup_return','remove_catalog_item','review_pickup','save_branch_inventory_day','save_daily_stock',
 'save_order_fulfillment','send_weekly_invoice','set_invoice_payment_status','submit_pickup','validate_catalog_options','weekly_invoice_details') loop
   definition=pg_get_functiondef(item.oid);
   definition=regexp_replace(definition,'(from|join) public\.profiles\M','\1 app_private.workspace_profiles','gi');
   execute definition;
   if item.prosecdef then execute format('alter function %s owner to ahaa_operations',item.oid::regprocedure); end if;
   execute format('grant execute on function %s to ahaa_operations',item.oid::regprocedure);
 end loop;
end; $$;

revoke create on schema public from ahaa_operations;

create policy operations_profile_read on public.profiles for select to ahaa_operations using(true);
create policy profile_business_boundary on public.profiles as restrictive for all to authenticated,ahaa_operations
using(id=auth.uid() or exists(select 1 from public.business_memberships m where m.user_id=profiles.id and m.business_id=public.current_business_id()))
with check(id=auth.uid() or exists(select 1 from public.business_memberships m where m.user_id=profiles.id and m.business_id=public.current_business_id()));
create policy operations_membership_read on public.business_memberships for select to ahaa_operations
using(business_id=public.current_business_id());
create policy operations_business_read on public.businesses for select to ahaa_operations using(id=public.current_business_id());

-- Policies that formerly inspected the global profile role now use membership roles.
drop policy category_admin on public.catalog_categories;
drop policy category_read on public.catalog_categories;
create policy category_admin on public.catalog_categories for all to authenticated using(public."current_role"()='CENTRAL_ADMIN') with check(public."current_role"()='CENTRAL_ADMIN');
create policy category_read on public.catalog_categories for select to authenticated using(public."current_role"() is not null);
drop policy unit_admin on public.catalog_units;
drop policy unit_read on public.catalog_units;
create policy unit_admin on public.catalog_units for all to authenticated using(public."current_role"()='CENTRAL_ADMIN') with check(public."current_role"()='CENTRAL_ADMIN');
create policy unit_read on public.catalog_units for select to authenticated using(public."current_role"() is not null);
drop policy branch_employee_catering on public.catering_events;
create policy branch_employee_catering on public.catering_events for all to authenticated
using(public."current_role"()='BRANCH_EMPLOYEE' and location_id=public.inventory_location())
with check(public."current_role"()='BRANCH_EMPLOYEE' and location_id=public.inventory_location());
drop policy purchase_receipts_scoped_read on public.purchase_receipts;
create policy purchase_receipts_scoped_read on public.purchase_receipts for select to authenticated
using(deleted_at is null and ((public."current_role"()='CENTRAL_ADMIN' and location_id is null) or (public."current_role"()='BRANCH_MANAGER' and location_id=public.current_location())));

-- Browser-supplied ownership cannot move existing records to a different business.
create function public.guard_business_ownership() returns trigger language plpgsql set search_path=''
as $$ begin if new.business_id is distinct from old.business_id then raise exception 'Business ownership cannot be changed'; end if; return new; end; $$;
do $$ declare table_name text; begin
 foreach table_name in array array['locations','catalog_categories','catalog_units','catalog_items','orders','order_lines','pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','weekly_invoices','weekly_invoice_publications','invoice_edits','catering_events','purchase_receipts'] loop
 execute format('create trigger business_ownership before update on public.%I for each row execute function public.guard_business_ownership()',table_name);
 end loop;
end; $$;

create function public.current_workspace() returns jsonb
language sql stable security definer set search_path=''
as $$ select jsonb_build_object('business',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'settings',b.settings),'profile',to_jsonb(p))
from public.businesses b join app_private.workspace_profiles p on p.id=auth.uid() where b.id=public.current_business_id(); $$;
revoke all on function public.current_workspace() from public,anon;
grant execute on function public.current_workspace() to authenticated;

-- Unscoped legacy service functions must not remain callable after this cutover.
revoke all on function public.create_purchase_receipt(uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.reserve_receipt_scan(uuid,uuid) from public,anon,authenticated,service_role;

-- Privileged server paths must carry an explicitly authorized business.
create function public.create_purchase_receipt_for_business(p_business_id uuid,p_id uuid,p_user_id uuid,p_file_name text,p_file_path text,p_file_hash text,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare branch uuid; member_role text;
begin
 perform pg_advisory_xact_lock(730030003);
 select m.role::text,m.location_id into member_role,branch from public.business_memberships m
 join public.businesses b on b.id=m.business_id join public.profiles p on p.id=m.user_id
 where m.business_id=p_business_id and m.user_id=p_user_id and m.status::text='active' and p.status::text='active'
 and b.status='active' and b.isolation_ready;
 if member_role is null or member_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER') or (member_role='BRANCH_MANAGER' and branch is null) then return false; end if;
 if p_model not in ('prebuilt-invoice','prebuilt-receipt') or length(p_file_name) not between 1 and 250 or p_file_hash !~ '^[0-9a-f]{64}$'
 or p_file_path !~ ('^'||p_business_id::text||'/'||p_id::text||'/original\.(pdf|png|jpg)$') then return false; end if;
 if member_role='CENTRAL_ADMIN' then branch=null; end if;
 insert into public.purchase_receipts(id,business_id,created_by,location_id,file_name,file_path,file_hash,model,category)
 values(p_id,p_business_id,p_user_id,branch,p_file_name,p_file_path,p_file_hash,p_model,case when p_model='prebuilt-receipt' then 'Miscellaneous' else 'Supplier Invoice' end)
 on conflict do nothing;
 return found;
end; $$;
revoke all on function public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text) to service_role;

create function public.reserve_receipt_scan_for_business(p_business_id uuid,p_receipt_id uuid,p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare month_key text:=to_char(now() at time zone 'UTC','YYYY-MM');
 user_day_key text:=p_user_id::text||':'||to_char(now() at time zone 'America/Toronto','YYYY-MM-DD');
 member_role text; branch uuid;
begin
 perform pg_advisory_xact_lock(730030003);
 select m.role::text,m.location_id into member_role,branch from public.business_memberships m
 join public.businesses b on b.id=m.business_id join public.profiles p on p.id=m.user_id
 where m.business_id=p_business_id and m.user_id=p_user_id and m.status::text='active' and p.status::text='active'
 and b.status='active' and b.isolation_ready;
 if member_role is null or member_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER') then return false; end if;
 if not exists(select 1 from public.purchase_receipts r where r.id=p_receipt_id and r.business_id=p_business_id and r.deleted_at is null
 and ((member_role='CENTRAL_ADMIN' and r.location_id is null) or (member_role='BRANCH_MANAGER' and branch is not null and r.location_id=branch))) then return false; end if;
 -- These ceilings deliberately span every business, including archived receipts.
 if (select coalesce(sum((scan_usage->>month_key)::integer),0) from public.purchase_receipts)>=100
 or (select coalesce(sum((scan_usage->>user_day_key)::integer),0) from public.purchase_receipts)>=10
 or exists(select 1 from public.purchase_receipts where scan_started_at>now()-interval '5 seconds')
 or exists(select 1 from public.purchase_receipts where id=p_receipt_id and scan_status='RUNNING' and scan_started_at>now()-interval '1 hour') then return false; end if;
 update public.purchase_receipts set
 scan_usage=jsonb_set(jsonb_set(scan_usage,array[month_key],to_jsonb(coalesce((scan_usage->>month_key)::integer,0)+1)),array[user_day_key],to_jsonb(coalesce((scan_usage->>user_day_key)::integer,0)+1)),
 scan_status='RUNNING',scan_started_at=now(),operation_url=null where id=p_receipt_id and business_id=p_business_id and deleted_at is null;
 return found;
end; $$;
revoke all on function public.reserve_receipt_scan_for_business(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_receipt_scan_for_business(uuid,uuid,uuid) to service_role;

commit;
