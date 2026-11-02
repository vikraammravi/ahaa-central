-- Generated application-schema baseline. REVIEW AND TEST ON EMPTY STAGING ONLY.

-- No production users, transactions or receipt files are included.

-- Existing incremental migrations predate this snapshot; do not replay them after it.

begin;

set local search_path = public, extensions;

set local check_function_bodies = off;

do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') then raise exception 'Baseline requires an empty public schema'; end if; end $$;

create type public."catering_status" as enum ('INQUIRY', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

create type public."order_status" as enum ('SUBMITTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

create type public."profile_status" as enum ('active', 'pending', 'disabled');

create type public."unit_measurement" as enum ('Bucket', 'Tray', 'Piece', 'Can', 'Box', 'Bottle', 'Bag');

create type public."user_role" as enum ('CENTRAL_ADMIN', 'BRANCH_MANAGER', 'BRANCH_EMPLOYEE');

create sequence public."stock_orders_order_number_seq" as integer increment by 1 minvalue 1 maxvalue 2147483647 start with 1 no cycle;

create table public."branch_inventory_counts" (
  "id" uuid default gen_random_uuid() not null,
  "location_id" uuid not null,
  "count_date" date not null,
  "submitted_by" uuid,
  "submitted_name" text not null,
  "submitted_at" timestamp with time zone default clock_timestamp() not null,
  "notes" text default ''::text not null,
  "flow_version" integer default 1 not null,
  "received_until" timestamp with time zone default clock_timestamp() not null
);

create table public."branch_inventory_lines" (
  "id" uuid default gen_random_uuid() not null,
  "count_id" uuid not null,
  "item_id" uuid not null,
  "item_name" text not null,
  "unit_type" text not null,
  "quantity" integer not null,
  "opening_quantity" bigint,
  "received_quantity" bigint,
  "used_quantity" integer,
  "wasted_quantity" integer,
  "adjustment_quantity" bigint
);

create table public."catalog_categories" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "is_active" boolean default true not null,
  "ever_used" boolean default false not null
);

create table public."catalog_items" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "category" text not null,
  "unit_type" text not null,
  "default_price" numeric(10,2) not null,
  "is_taxable" boolean default false,
  "available_stock" integer default 0,
  "is_active" boolean default true,
  "updated_at" timestamp with time zone default now(),
  "low_stock_threshold" integer default 20 not null,
  "archived_at" timestamp with time zone
);

create table public."catalog_units" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "is_active" boolean default true not null,
  "ever_used" boolean default false not null
);

create table public."catering_events" (
  "id" uuid default gen_random_uuid() not null,
  "location_id" uuid not null,
  "customer_name" text not null,
  "customer_phone" text not null,
  "guest_count" integer not null,
  "event_datetime" timestamp with time zone not null,
  "total_amount" numeric(10,2) not null,
  "advance_paid" numeric(10,2) default 0.00,
  "balance_due" numeric(10,2) not null,
  "status" catering_status default 'CONFIRMED'::catering_status,
  "checklist" jsonb default '[]'::jsonb,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "fulfillment_method" text default 'PICKUP'::text not null,
  "delivery_address" text
);

create table public."invoice_edits" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "revision" integer not null,
  "edited_by" uuid,
  "edited_at" timestamp with time zone default now() not null,
  "reason" text not null,
  "previous_lines" jsonb not null,
  "updated_lines" jsonb not null,
  "stock_adjustments" jsonb not null
);

create table public."locations" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "address" text,
  "phone" text,
  "is_central" boolean default false,
  "created_at" timestamp with time zone default now(),
  "city" text,
  "province" text
);

create table public."order_lines" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "item_id" uuid not null,
  "quantity" integer not null,
  "unit_price" numeric(10,2) not null,
  "is_taxable" boolean not null,
  "line_total" numeric(10,2) not null,
  "fulfilled_quantity" integer default 0 not null,
  "shortage_reason" text,
  "final_line_total" numeric generated always as (((fulfilled_quantity)::numeric * unit_price)) stored,
  "invoice_quantity" integer,
  "invoice_is_taxable" boolean,
  "invoice_line_total" numeric generated always as (((COALESCE(invoice_quantity, fulfilled_quantity))::numeric * unit_price)) stored
);

create table public."orders" (
  "id" uuid default gen_random_uuid() not null,
  "order_number" integer default nextval('stock_orders_order_number_seq'::regclass) not null,
  "location_id" uuid not null,
  "status" order_status default 'SUBMITTED'::order_status,
  "subtotal" numeric(10,2) default 0.00 not null,
  "tax_amount" numeric(10,2) default 0.00 not null,
  "total_amount" numeric(10,2) default 0.00 not null,
  "order_date" date default ((now() AT TIME ZONE 'America/Toronto'::text))::date,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "final_subtotal" numeric default 0.00 not null,
  "final_tax_amount" numeric default 0.00 not null,
  "final_total_amount" numeric default 0.00 not null,
  "stock_deducted_at" timestamp with time zone,
  "pickup_approval_status" text,
  "invoice_revision" integer default 0 not null,
  "pickup_confirmed_by" uuid,
  "pickup_confirmed_at" timestamp with time zone,
  "weekly_invoice_id" uuid
);

create table public."pickup_request_lines" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "order_line_id" uuid not null,
  "item_id" uuid not null,
  "prepared_quantity" integer not null,
  "pickup_quantity" integer not null,
  "return_to_stock" boolean,
  "stock_adjustment" integer default 0 not null,
  "extra_stock_debited" integer default 0 not null,
  "allocation_shortfall" integer default 0 not null,
  "return_quantity" integer default 0 not null
);

create table public."pickup_requests" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "status" text default 'PENDING'::text not null,
  "reason" text not null,
  "requested_by" uuid,
  "requested_at" timestamp with time zone default now() not null,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "already_collected" boolean default false not null,
  "return_status" text,
  "return_received_at" timestamp with time zone,
  "return_received_by" uuid,
  "return_note" text
);

create table public."profiles" (
  "id" uuid not null,
  "email" text not null,
  "full_name" text default ''::text,
  "role" user_role default 'BRANCH_MANAGER'::user_role not null,
  "location_id" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "status" profile_status default 'pending'::profile_status not null,
  "phone" text
);

create table public."purchase_receipts" (
  "id" uuid default gen_random_uuid() not null,
  "created_by" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "file_name" text not null,
  "file_path" text not null,
  "file_hash" text not null,
  "model" text not null,
  "category" text default 'Miscellaneous'::text not null,
  "status" text default 'DRAFT'::text not null,
  "scan_status" text default 'NOT_SCANNED'::text not null,
  "operation_url" text,
  "scan_started_at" timestamp with time zone,
  "scan_usage" jsonb default '{}'::jsonb not null,
  "details" jsonb default '{}'::jsonb not null,
  "warnings" jsonb default '[]'::jsonb not null
);

create table public."weekly_invoice_publications" (
  "id" uuid default gen_random_uuid() not null,
  "weekly_invoice_id" uuid not null,
  "revision" integer not null,
  "published_at" timestamp with time zone default now() not null,
  "published_by" uuid,
  "snapshot" jsonb not null
);

create table public."weekly_invoices" (
  "id" uuid default gen_random_uuid() not null,
  "location_id" uuid not null,
  "start_date" date not null,
  "end_date" date not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "revision" integer default 0 not null,
  "sent_revision" integer,
  "sent_at" timestamp with time zone,
  "sent_by" uuid,
  "needs_sending" boolean generated always as ((sent_revision IS DISTINCT FROM revision)) stored,
  "payment_status" text default 'UNPAID'::text not null,
  "payment_updated_at" timestamp with time zone,
  "payment_updated_by" uuid,
  "payment_updated_name" text,
  "payment_revision" integer
);

alter table public."branch_inventory_counts" add constraint "branch_inventory_counts_pkey" PRIMARY KEY (id);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_count_id_item_id_key" UNIQUE (count_id, item_id);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_opening_quantity_check" CHECK (opening_quantity >= 0);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_pkey" PRIMARY KEY (id);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_quantity_check" CHECK (quantity >= 0);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_received_quantity_check" CHECK (received_quantity >= 0);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_used_quantity_check" CHECK (used_quantity >= 0);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_wasted_quantity_check" CHECK (wasted_quantity >= 0);

alter table public."catalog_categories" add constraint "catalog_categories_name_key" UNIQUE (name);

alter table public."catalog_categories" add constraint "catalog_categories_pkey" PRIMARY KEY (id);

alter table public."catalog_categories" add constraint "catalog_category_name" CHECK (name = btrim(name) AND length(name) >= 1 AND length(name) <= 60);

alter table public."catalog_items" add constraint "catalog_archived_inactive" CHECK (archived_at IS NULL OR is_active IS FALSE);

alter table public."catalog_items" add constraint "catalog_items_available_stock_check" CHECK (available_stock >= 0);

alter table public."catalog_items" add constraint "catalog_items_default_price_check" CHECK (default_price >= 0::numeric);

alter table public."catalog_items" add constraint "catalog_items_low_stock_threshold_check" CHECK (low_stock_threshold >= 0);

alter table public."catalog_items" add constraint "catalog_items_pkey" PRIMARY KEY (id);

alter table public."catalog_units" add constraint "catalog_category_name" CHECK (name = btrim(name) AND length(name) >= 1 AND length(name) <= 60);

alter table public."catalog_units" add constraint "catalog_units_name_key" UNIQUE (name);

alter table public."catalog_units" add constraint "catalog_units_pkey" PRIMARY KEY (id);

alter table public."catering_events" add constraint "catering_delivery_address" CHECK (fulfillment_method = 'PICKUP'::text AND delivery_address IS NULL OR fulfillment_method = 'DELIVERY'::text AND delivery_address IS NOT NULL AND length(delivery_address) <= 1000 AND delivery_address ~ '[^[:space:]]'::text);

alter table public."catering_events" add constraint "catering_events_advance_paid_check" CHECK (advance_paid >= 0::numeric);

alter table public."catering_events" add constraint "catering_events_balance_due_check" CHECK (balance_due >= 0::numeric);

alter table public."catering_events" add constraint "catering_events_guest_count_check" CHECK (guest_count > 0);

alter table public."catering_events" add constraint "catering_events_pkey" PRIMARY KEY (id);

alter table public."catering_events" add constraint "catering_events_total_amount_check" CHECK (total_amount >= 0::numeric);

alter table public."catering_events" add constraint "catering_fulfillment_method" CHECK (fulfillment_method = ANY (ARRAY['PICKUP'::text, 'DELIVERY'::text]));

alter table public."invoice_edits" add constraint "invoice_edits_order_id_revision_key" UNIQUE (order_id, revision);

alter table public."invoice_edits" add constraint "invoice_edits_pkey" PRIMARY KEY (id);

alter table public."locations" add constraint "locations_pkey" PRIMARY KEY (id);

alter table public."order_lines" add constraint "order_lines_invoice_quantity_check" CHECK (invoice_quantity >= 0);

alter table public."order_lines" add constraint "stock_order_items_fulfilled_quantity_check" CHECK (fulfilled_quantity >= 0);

alter table public."order_lines" add constraint "stock_order_items_pkey" PRIMARY KEY (id);

alter table public."order_lines" add constraint "stock_order_items_quantity_check" CHECK (quantity > 0);

alter table public."orders" add constraint "orders_pickup_approval_status_check" CHECK (pickup_approval_status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]));

alter table public."orders" add constraint "stock_orders_pkey" PRIMARY KEY (id);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_pickup_quantity_check" CHECK (pickup_quantity >= 0);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_pkey" PRIMARY KEY (id);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_prepared_quantity_check" CHECK (prepared_quantity >= 0);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_request_id_order_line_id_key" UNIQUE (request_id, order_line_id);

alter table public."pickup_requests" add constraint "pickup_requests_pkey" PRIMARY KEY (id);

alter table public."pickup_requests" add constraint "pickup_requests_return_status_check" CHECK (return_status = ANY (ARRAY['PENDING'::text, 'RECEIVED'::text]));

alter table public."pickup_requests" add constraint "pickup_requests_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]));

alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table public."purchase_receipts" add constraint "purchase_receipts_file_hash_key" UNIQUE (file_hash);

alter table public."purchase_receipts" add constraint "purchase_receipts_file_path_key" UNIQUE (file_path);

alter table public."purchase_receipts" add constraint "purchase_receipts_model_check" CHECK (model = ANY (ARRAY['prebuilt-invoice'::text, 'prebuilt-receipt'::text]));

alter table public."purchase_receipts" add constraint "purchase_receipts_pkey" PRIMARY KEY (id);

alter table public."purchase_receipts" add constraint "purchase_receipts_scan_status_check" CHECK (scan_status = ANY (ARRAY['NOT_SCANNED'::text, 'RUNNING'::text, 'SUCCEEDED'::text, 'FAILED'::text]));

alter table public."purchase_receipts" add constraint "purchase_receipts_status_check" CHECK (status = ANY (ARRAY['DRAFT'::text, 'SAVED'::text]));

alter table public."weekly_invoice_publications" add constraint "weekly_invoice_publications_pkey" PRIMARY KEY (id);

alter table public."weekly_invoice_publications" add constraint "weekly_invoice_publications_weekly_invoice_id_revision_key" UNIQUE (weekly_invoice_id, revision);

alter table public."weekly_invoices" add constraint "weekly_invoices_check" CHECK (start_date <= end_date);

alter table public."weekly_invoices" add constraint "weekly_invoices_payment_status_check" CHECK (payment_status = ANY (ARRAY['UNPAID'::text, 'PAID'::text]));

alter table public."weekly_invoices" add constraint "weekly_invoices_pkey" PRIMARY KEY (id);

alter table public."branch_inventory_counts" add constraint "branch_inventory_counts_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);

alter table public."branch_inventory_counts" add constraint "branch_inventory_counts_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_count_id_fkey" FOREIGN KEY (count_id) REFERENCES branch_inventory_counts(id);

alter table public."branch_inventory_lines" add constraint "branch_inventory_lines_item_id_fkey" FOREIGN KEY (item_id) REFERENCES catalog_items(id);

alter table public."catalog_items" add constraint "catalog_category_option_fk" FOREIGN KEY (category) REFERENCES catalog_categories(name) ON UPDATE CASCADE;

alter table public."catalog_items" add constraint "catalog_unit_option_fk" FOREIGN KEY (unit_type) REFERENCES catalog_units(name) ON UPDATE CASCADE;

alter table public."catering_events" add constraint "catering_events_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;

alter table public."invoice_edits" add constraint "invoice_edits_edited_by_fkey" FOREIGN KEY (edited_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."invoice_edits" add constraint "invoice_edits_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id);

alter table public."order_lines" add constraint "stock_order_items_item_id_fkey" FOREIGN KEY (item_id) REFERENCES catalog_items(id) ON DELETE RESTRICT;

alter table public."order_lines" add constraint "stock_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table public."orders" add constraint "orders_pickup_confirmed_by_fkey" FOREIGN KEY (pickup_confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."orders" add constraint "orders_weekly_invoice_id_fkey" FOREIGN KEY (weekly_invoice_id) REFERENCES weekly_invoices(id);

alter table public."orders" add constraint "stock_orders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."orders" add constraint "stock_orders_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;

alter table public."pickup_request_lines" add constraint "pickup_request_lines_item_id_fkey" FOREIGN KEY (item_id) REFERENCES catalog_items(id);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_order_line_id_fkey" FOREIGN KEY (order_line_id) REFERENCES order_lines(id);

alter table public."pickup_request_lines" add constraint "pickup_request_lines_request_id_fkey" FOREIGN KEY (request_id) REFERENCES pickup_requests(id);

alter table public."pickup_requests" add constraint "pickup_requests_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id);

alter table public."pickup_requests" add constraint "pickup_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pickup_requests" add constraint "pickup_requests_return_received_by_fkey" FOREIGN KEY (return_received_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."pickup_requests" add constraint "pickup_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."profiles" add constraint "profiles_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public."purchase_receipts" add constraint "purchase_receipts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."weekly_invoice_publications" add constraint "weekly_invoice_publications_published_by_fkey" FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."weekly_invoice_publications" add constraint "weekly_invoice_publications_weekly_invoice_id_fkey" FOREIGN KEY (weekly_invoice_id) REFERENCES weekly_invoices(id);

alter table public."weekly_invoices" add constraint "weekly_invoices_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."weekly_invoices" add constraint "weekly_invoices_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);

alter table public."weekly_invoices" add constraint "weekly_invoices_payment_updated_by_fkey" FOREIGN KEY (payment_updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public."weekly_invoices" add constraint "weekly_invoices_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX branch_inventory_counts_latest ON public.branch_inventory_counts USING btree (location_id, count_date DESC, submitted_at DESC, id);

CREATE INDEX catalog_active_name_page ON public.catalog_items USING btree (is_active, name, id);

CREATE UNIQUE INDEX catalog_categories_name_ci ON public.catalog_categories USING btree (lower(name));

CREATE UNIQUE INDEX catalog_units_lower_idx ON public.catalog_units USING btree (lower(name));

CREATE UNIQUE INDEX catalog_units_name_ci ON public.catalog_units USING btree (lower(name));

CREATE INDEX catering_events_location_idx ON public.catering_events USING btree (location_id);

CREATE INDEX catering_location_status_date ON public.catering_events USING btree (location_id, status, event_datetime, id);

CREATE INDEX orders_admin_filters ON public.orders USING btree (order_date, location_id, status);

CREATE INDEX orders_admin_page ON public.orders USING btree (created_at DESC, id);

CREATE INDEX orders_weekly_invoice ON public.orders USING btree (weekly_invoice_id);

CREATE UNIQUE INDEX pickup_requests_one_pending ON public.pickup_requests USING btree (order_id) WHERE (status = 'PENDING'::text);

CREATE INDEX pickup_requests_order_history ON public.pickup_requests USING btree (order_id, requested_at DESC);

CREATE INDEX purchase_receipts_created_at_idx ON public.purchase_receipts USING btree (created_at DESC);

CREATE INDEX stock_order_items_order_idx ON public.order_lines USING btree (order_id);

CREATE INDEX stock_orders_location_idx ON public.orders USING btree (location_id);

CREATE INDEX stock_orders_status_idx ON public.orders USING btree (status);

CREATE OR REPLACE FUNCTION public.admin_branch_stock(p_page integer DEFAULT 0, p_search text DEFAULT ''::text, p_category text DEFAULT ''::text, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare branch record; state jsonb; branch_list jsonb:='[]'; inventories jsonb:='{}'; result jsonb; stock_date date:=(now() at time zone 'America/Toronto')::date;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active') then raise exception 'Only an active central admin can view all branch stock.';end if;
 if p_page is null or p_page<0 then raise exception 'Choose a valid page.';end if;
 if p_branch_id is not null and not exists(select 1 from public.locations where id=p_branch_id and is_central=false) then raise exception 'Branch not found.';end if;
 -- Reuse the exact stock calculation used by each branch, once per branch.
 for branch in select id,name from public.locations where is_central=false and (p_branch_id is null or id=p_branch_id) order by lower(name),id loop
 state:=public.inventory_day_state(branch.id,stock_date);
 branch_list:=branch_list||jsonb_build_array(jsonb_build_object('id',branch.id,'name',branch.name));
 inventories:=inventories||jsonb_build_object(branch.id::text,coalesce(state->'items','[]'));
 end loop;
 with branch_values as (
 select b.key branch_id,(item->>'id')::uuid item_id,(item->>'quantity')::numeric quantity
 from jsonb_each(inventories) b cross join lateral jsonb_array_elements(b.value) item
 ), balances as (
 select item_id,jsonb_object_agg(branch_id,quantity) branch_stock from branch_values group by item_id
 ), products as materialized (
 select c.id,c.name,c.category,c.unit_type,coalesce(c.available_stock,0) central_stock,coalesce(b.branch_stock,'{}') branch_stock
 from public.catalog_items c left join balances b on b.item_id=c.id
 where c.archived_at is null or exists(select 1 from jsonb_each_text(b.branch_stock) entry where entry.value::numeric>0)
 ), filtered as materialized (
 select * from products where (coalesce(p_category,'')='' or category=p_category)
 and (coalesce(trim(p_search),'')='' or position(lower(trim(p_search)) in lower(name))>0)
 ), totals as (select count(*) count from filtered), paging as (select count,least(p_page,greatest(0,((count-1)/25)::integer)) page from totals)
 select jsonb_build_object(
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by lower(r.category),lower(r.name),r.id) from(select * from filtered order by lower(category),lower(name),id limit 25 offset (select page*25 from paging)) r),'[]'),
 'count',paging.count,'page',paging.page,'branches',branch_list,
 'categories',coalesce((select jsonb_agg(category order by lower(category),category) from(select distinct category from products) c),'[]'),
 'as_of',now()
 ) into result from paging;
 return result;
end;$function$;

revoke all on function public."admin_branch_stock"(p_page integer, p_search text, p_category text, p_branch_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."admin_branch_stock"(p_page integer, p_search text, p_category text, p_branch_id uuid) to "authenticated";

grant execute on function public."admin_branch_stock"(p_page integer, p_search text, p_category text, p_branch_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare start_at timestamptz; end_at timestamptz; summary jsonb; recent jsonb; stock jsonb;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can view the dashboard.'; end if;
 start_at := ((now() at time zone 'America/Toronto')::date)::timestamp at time zone 'America/Toronto';
 end_at := (((now() at time zone 'America/Toronto')::date + 1)::timestamp) at time zone 'America/Toronto';
 select jsonb_build_object('ordersToday', count(*),
 'pendingOrders', count(*) filter(where status::text in ('SUBMITTED', 'PREPARING')),
 'revenueToday', coalesce(sum(final_total_amount) filter(where status::text = 'COMPLETED'), 0))
 into summary from public.orders where created_at >= start_at and created_at < end_at;
 select coalesce(jsonb_agg(row_data), '[]'::jsonb) into recent from (
 select to_jsonb(o) || jsonb_build_object('locations', jsonb_build_object('name', l.name)) as row_data
 from public.orders o left join public.locations l on l.id = o.location_id
 where o.created_at >= start_at and o.created_at < end_at order by o.created_at desc, o.id limit 5
 ) latest;
 select coalesce(jsonb_agg(row_data), '[]'::jsonb) into stock from (
 select to_jsonb(c) as row_data from public.catalog_items c
 where c.is_active = true and (coalesce(c.available_stock, 0) <= 0 or c.available_stock < coalesce(c.low_stock_threshold, 20))
 order by c.available_stock, c.id limit 6
 ) low;
 return summary || jsonb_build_object('recentOrders', recent, 'lowItems', stock, 'businessDate', (now() at time zone 'America/Toronto')::date,
 'lowStock', (select count(*) from public.catalog_items where is_active = true and (coalesce(available_stock, 0) <= 0 or available_stock < coalesce(low_stock_threshold, 20))));
end;
$function$;

revoke all on function public."admin_dashboard_summary"() from public, anon, authenticated, service_role;

grant execute on function public."admin_dashboard_summary"() to "authenticated";

grant execute on function public."admin_dashboard_summary"() to "service_role";

CREATE OR REPLACE FUNCTION public.admin_order_counts(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can view order counts.'; end if;
 select jsonb_build_object(
 'ALL', count(*), 'SUBMITTED', count(*) filter(where status::text = 'SUBMITTED'),
 'PREPARING', count(*) filter(where status::text = 'PREPARING'), 'READY', count(*) filter(where status::text = 'READY'),
 'COMPLETED', count(*) filter(where status::text = 'COMPLETED'), 'CANCELLED', count(*) filter(where status::text = 'CANCELLED')
 ) into result from public.orders
 where (p_start_date is null or order_date >= p_start_date) and (p_end_date is null or order_date <= p_end_date)
 and (p_location_id is null or location_id = p_location_id);
 return result;
end;
$function$;

revoke all on function public."admin_order_counts"(p_start_date date, p_end_date date, p_location_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."admin_order_counts"(p_start_date date, p_end_date date, p_location_id uuid) to "authenticated";

grant execute on function public."admin_order_counts"(p_start_date date, p_end_date date, p_location_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.branch_inventory_workspace(p_count_date date DEFAULT ((now() AT TIME ZONE 'America/Toronto'::text))::date, p_location_id uuid DEFAULT NULL::uuid, p_history_page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."branch_inventory_workspace"(p_count_date date, p_location_id uuid, p_history_page integer) from public, anon, authenticated, service_role;

grant execute on function public."branch_inventory_workspace"(p_count_date date, p_location_id uuid, p_history_page integer) to "authenticated";

grant execute on function public."branch_inventory_workspace"(p_count_date date, p_location_id uuid, p_history_page integer) to "service_role";

CREATE OR REPLACE FUNCTION public.catalog_page(p_page integer DEFAULT 0, p_search text DEFAULT ''::text, p_category text DEFAULT ''::text, p_status text DEFAULT 'all'::text, p_stock_status text DEFAULT 'ALL'::text, p_stock_overrides jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active') then raise exception 'An active central admin is required.';end if;
 if p_page is null or p_page<0 or p_status not in('all','active','inactive') or p_stock_status not in('ALL','in-stock','low-stock','out-of-stock') or jsonb_typeof(p_stock_overrides) is distinct from 'object' then raise exception 'Choose valid catalog filters.';end if;
 with products as materialized(
 select c.*,c.category as normalized_category,
 case when coalesce(p_stock_overrides->>c.id::text,'') ~ '^\d{1,10}$' then (p_stock_overrides->>c.id::text)::bigint else c.available_stock end as displayed_stock
 from public.catalog_items c where c.archived_at is null
 ), filtered as materialized(
 select * from products where (p_status='all' or is_active=(p_status='active'))
 and (coalesce(p_category,'')='' or normalized_category=p_category)
 and (coalesce(trim(p_search),'')='' or position(lower(trim(p_search)) in lower(name))>0)
 and (p_stock_status='ALL' or case when displayed_stock<=0 then 'out-of-stock' when displayed_stock<coalesce(low_stock_threshold,20) then 'low-stock' else 'in-stock' end=p_stock_status)
 ), totals as(select count(*) as count from filtered), paging as(select count,least(p_page,greatest(0,((count-1)/25)::integer)) as page from totals)
 select jsonb_build_object(
 'rows',coalesce((select jsonb_agg(to_jsonb(r)-'normalized_category'-'displayed_stock' order by lower(r.normalized_category),lower(r.name),r.id) from(select * from filtered order by lower(normalized_category),lower(name),id limit 25 offset (select page*25 from paging)) r),'[]'),
 'count',paging.count,'page',paging.page,
 'categories',coalesce((select jsonb_agg(category order by category) from(select distinct normalized_category as category from products) categories),'[]')
 ) into result from paging;
 return result;
end; $function$;

revoke all on function public."catalog_page"(p_page integer, p_search text, p_category text, p_status text, p_stock_status text, p_stock_overrides jsonb) from public, anon, authenticated, service_role;

grant execute on function public."catalog_page"(p_page integer, p_search text, p_category text, p_status text, p_stock_status text, p_stock_overrides jsonb) to "authenticated";

grant execute on function public."catalog_page"(p_page integer, p_search text, p_category text, p_status text, p_stock_status text, p_stock_overrides jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.complete_past_catering_events(p_location_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 end; $function$;

revoke all on function public."complete_past_catering_events"(p_location_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."complete_past_catering_events"(p_location_id uuid) to "authenticated";

grant execute on function public."complete_past_catering_events"(p_location_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.create_branch_order(p_order_id uuid, p_quantities jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 end; $function$;

revoke all on function public."create_branch_order"(p_order_id uuid, p_quantities jsonb) from public, anon, authenticated, service_role;

grant execute on function public."create_branch_order"(p_order_id uuid, p_quantities jsonb) to "authenticated";

grant execute on function public."create_branch_order"(p_order_id uuid, p_quantities jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.create_weekly_invoice(p_location_id uuid, p_start_date date, p_end_date date, p_order_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid; target public.orders%rowtype; total integer:=0;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can create weekly invoices.'; end if;
 if p_location_id is null or p_start_date is null or p_end_date is null or p_start_date>p_end_date or coalesce(cardinality(p_order_ids),0)=0 then raise exception 'Choose a branch, dates, and completed orders.'; end if;
 if cardinality(p_order_ids)<>(select count(distinct id) from unnest(p_order_ids) id) then raise exception 'Select each order once.'; end if;
 for target in select * from public.orders where id=any(p_order_ids) order by id for update loop
 total:=total+1;
 if target.location_id<>p_location_id or target.order_date<p_start_date or target.order_date>p_end_date or target.status::text is distinct from 'COMPLETED'
 or target.weekly_invoice_id is not null or target.pickup_approval_status='PENDING'
 or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Select completed, settled, unbilled orders from the same branch and date range.'; end if;
 end loop;
 if total<>cardinality(p_order_ids) then raise exception 'One of the selected orders is unavailable.'; end if;
 insert into public.weekly_invoices(location_id,start_date,end_date,created_by) values(p_location_id,p_start_date,p_end_date,auth.uid()) returning id into result;
 update public.orders set weekly_invoice_id=result,updated_at=clock_timestamp() where id=any(p_order_ids);
 return result;
end; $function$;

revoke all on function public."create_weekly_invoice"(p_location_id uuid, p_start_date date, p_end_date date, p_order_ids uuid[]) from public, anon, authenticated, service_role;

grant execute on function public."create_weekly_invoice"(p_location_id uuid, p_start_date date, p_end_date date, p_order_ids uuid[]) to "authenticated";

grant execute on function public."create_weekly_invoice"(p_location_id uuid, p_start_date date, p_end_date date, p_order_ids uuid[]) to "service_role";

CREATE OR REPLACE FUNCTION public.current_location()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select location_id from public.profiles where id=auth.uid() and status::text='active' and role::text in ('CENTRAL_ADMIN','BRANCH_MANAGER');
$function$;

revoke all on function public."current_location"() from public, anon, authenticated, service_role;

grant execute on function public."current_location"() to public;

grant execute on function public."current_location"() to "anon";

grant execute on function public."current_location"() to "authenticated";

grant execute on function public."current_location"() to "service_role";

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select role::text from public.profiles where id = auth.uid() and status::text = 'active';
$function$;

revoke all on function public."current_role"() from public, anon, authenticated, service_role;

grant execute on function public."current_role"() to public;

grant execute on function public."current_role"() to "anon";

grant execute on function public."current_role"() to "authenticated";

grant execute on function public."current_role"() to "service_role";

CREATE OR REPLACE FUNCTION public.deduct_stock_when_order_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item record; remaining numeric;
begin
if tg_op = 'INSERT' then
if new.status::text <> 'SUBMITTED' then raise exception 'New orders must be Submitted.'; end if;
new.stock_deducted_at := null; return new; end if;
new.stock_deducted_at := old.stock_deducted_at;
if old.stock_deducted_at is not null then
if new.status::text in ('SUBMITTED', 'PREPARING') then raise exception 'An order already prepared cannot return to an earlier status.'; end if; return new; end if;
if new.status::text = 'COMPLETED' then raise exception 'Mark the order Ready before completing it.'; end if;
if new.status::text = 'READY' and old.status::text is distinct from 'READY' then
if not exists (select 1 from public.profiles where id = auth.uid() and role::text = 'CENTRAL_ADMIN' and status::text = 'active') then raise exception 'Only an active central admin can mark an order Ready.'; end if;
if not exists (select 1 from public.order_lines where order_id = new.id) then raise exception 'Cannot mark an order without line items Ready.'; end if;
if exists (select 1 from public.order_lines where order_id = new.id and (fulfilled_quantity is null or fulfilled_quantity < 0 or fulfilled_quantity > quantity)) then raise exception 'Save valid fulfillment quantities before marking this order Ready.'; end if;
for item in select item_id, sum(fulfilled_quantity) as quantity from public.order_lines where order_id = new.id group by item_id order by item_id loop
select available_stock into remaining from public.catalog_items where id = item.item_id for update;
if not found then raise exception 'A catalog item on this order no longer exists.'; end if;
if remaining < item.quantity then raise exception 'Insufficient stock for item %: % available, % fulfilled.', item.item_id, remaining, item.quantity; end if;
update public.catalog_items set available_stock = available_stock - item.quantity, updated_at = now() where id = item.item_id;
if not found then raise exception 'Unable to update stock for item %.', item.item_id; end if;
end loop; new.stock_deducted_at := now(); end if; return new; end; $function$;

revoke all on function public."deduct_stock_when_order_ready"() from public, anon, authenticated, service_role;

grant execute on function public."deduct_stock_when_order_ready"() to public;

grant execute on function public."deduct_stock_when_order_ready"() to "anon";

grant execute on function public."deduct_stock_when_order_ready"() to "authenticated";

grant execute on function public."deduct_stock_when_order_ready"() to "service_role";

CREATE OR REPLACE FUNCTION public.default_fulfilled_qty()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 if new.fulfilled_quantity = 0 then
 new.fulfilled_quantity := new.quantity;
 end if;
 return new;
end $function$;

revoke all on function public."default_fulfilled_qty"() from public, anon, authenticated, service_role;

grant execute on function public."default_fulfilled_qty"() to public;

grant execute on function public."default_fulfilled_qty"() to "anon";

grant execute on function public."default_fulfilled_qty"() to "authenticated";

grant execute on function public."default_fulfilled_qty"() to "service_role";

CREATE OR REPLACE FUNCTION public.edit_invoice(p_order_id uuid, p_lines jsonb, p_reason text, p_expected_updated_at timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.orders%rowtype; line record; input jsonb; qty numeric; before_lines jsonb; changed boolean:=false; total integer;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can edit invoices.'; end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.status::text not in ('READY','COMPLETED') then raise exception 'Invoices can be edited when Ready or Completed.'; end if;
 if target.pickup_approval_status='PENDING' or exists(select 1 from public.pickup_requests where order_id=target.id and return_status='PENDING') then raise exception 'Resolve pickup approval or returns first.'; end if;
 if target.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice changed. Reload before saving.'; end if;
 if target.weekly_invoice_id is not null then perform 1 from public.weekly_invoices where id=target.weekly_invoice_id for update; end if;
 select count(*) into total from public.order_lines where order_id=target.id;
 if jsonb_typeof(p_lines) is distinct from 'array' or total=0 or jsonb_array_length(p_lines)<>total or (select count(distinct value->>'line_id') from jsonb_array_elements(p_lines))<>total then raise exception 'Provide every invoice line once.'; end if;
 before_lines:=public.invoice_lines_snapshot(target.id);
 for line in select * from public.order_lines where order_id=target.id order by id for update loop
 select value into input from jsonb_array_elements(p_lines) where value->>'line_id'=line.id::text;
 if input is null or jsonb_typeof(input->'quantity') is distinct from 'number' or jsonb_typeof(input->'is_taxable') is distinct from 'boolean' then raise exception 'Invalid invoice values.'; end if;
 qty:=(input->>'quantity')::numeric;
 if qty<0 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Invoice quantity must be a nonnegative whole number.'; end if;
 if input ? 'unit_price' and (input->>'unit_price')::numeric is distinct from line.unit_price then raise exception 'Unit prices are locked.'; end if;
 changed:=changed or qty<>coalesce(line.invoice_quantity,line.fulfilled_quantity) or (input->>'is_taxable')::boolean<>coalesce(line.invoice_is_taxable,line.is_taxable);
 update public.order_lines set invoice_quantity=qty::integer,invoice_is_taxable=(input->>'is_taxable')::boolean where id=line.id;
 end loop;
 if not changed then raise exception 'No changes to save.'; end if;
 update public.orders set invoice_revision=invoice_revision+1,updated_at=clock_timestamp() where id=target.id;
 insert into public.invoice_edits(order_id,revision,edited_by,reason,previous_lines,updated_lines,stock_adjustments)
 values(target.id,target.invoice_revision+1,auth.uid(),coalesce(trim(p_reason),''),before_lines,public.invoice_lines_snapshot(target.id),'[]');
 if target.weekly_invoice_id is not null then update public.weekly_invoices set revision=revision+1 where id=target.weekly_invoice_id; end if;
 return target.invoice_revision+1;
end; $function$;

revoke all on function public."edit_invoice"(p_order_id uuid, p_lines jsonb, p_reason text, p_expected_updated_at timestamp with time zone) from public, anon, authenticated, service_role;

grant execute on function public."edit_invoice"(p_order_id uuid, p_lines jsonb, p_reason text, p_expected_updated_at timestamp with time zone) to "authenticated";

grant execute on function public."edit_invoice"(p_order_id uuid, p_lines jsonb, p_reason text, p_expected_updated_at timestamp with time zone) to "service_role";

CREATE OR REPLACE FUNCTION public.edit_submitted_branch_order(p_order_id uuid, p_quantities jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."edit_submitted_branch_order"(p_order_id uuid, p_quantities jsonb, p_expected_updated_at timestamp with time zone) from public, anon, authenticated, service_role;

grant execute on function public."edit_submitted_branch_order"(p_order_id uuid, p_quantities jsonb, p_expected_updated_at timestamp with time zone) to "authenticated";

grant execute on function public."edit_submitted_branch_order"(p_order_id uuid, p_quantities jsonb, p_expected_updated_at timestamp with time zone) to "service_role";

CREATE OR REPLACE FUNCTION public.guard_billing_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated','anon') then
 if tg_op='INSERT' then
 if new.invoice_quantity is not null or new.invoice_is_taxable is not null then raise exception 'Billing corrections must use the invoice editor.'; end if;
 elsif new.invoice_quantity is distinct from old.invoice_quantity or new.invoice_is_taxable is distinct from old.invoice_is_taxable or new.unit_price is distinct from old.unit_price then
 raise exception 'Invoice quantities and tax must use the invoice editor. Unit prices are locked.';
 end if;
 end if;
 return new;
end; $function$;

revoke all on function public."guard_billing_fields"() from public, anon, authenticated, service_role;

grant execute on function public."guard_billing_fields"() to public;

grant execute on function public."guard_billing_fields"() to "anon";

grant execute on function public."guard_billing_fields"() to "authenticated";

grant execute on function public."guard_billing_fields"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_catalog_history_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.order_lines where item_id=old.id)
 or exists(select 1 from public.pickup_request_lines where item_id=old.id)
 or exists(select 1 from public.branch_inventory_lines where item_id=old.id) then
 raise exception 'This item has order or inventory history. Archive it instead.';
 end if;
 return old;
end; $function$;

revoke all on function public."guard_catalog_history_delete"() from public, anon, authenticated, service_role;

grant execute on function public."guard_catalog_history_delete"() to public;

grant execute on function public."guard_catalog_history_delete"() to "anon";

grant execute on function public."guard_catalog_history_delete"() to "authenticated";

grant execute on function public."guard_catalog_history_delete"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_catalog_option_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.ever_used then raise exception 'This option has been used. Deactivate it instead.';end if;
 return old;
end;$function$;

revoke all on function public."guard_catalog_option_delete"() from public, anon, authenticated, service_role;

grant execute on function public."guard_catalog_option_delete"() to public;

grant execute on function public."guard_catalog_option_delete"() to "anon";

grant execute on function public."guard_catalog_option_delete"() to "authenticated";

grant execute on function public."guard_catalog_option_delete"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_invoice_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated','anon') then
 if tg_op='INSERT' then
 if new.payment_status<>'UNPAID' or new.payment_updated_at is not null or new.payment_updated_by is not null or new.payment_updated_name is not null or new.payment_revision is not null then raise exception 'Use the admin payment action.';end if;
 elsif new.payment_status is distinct from old.payment_status or new.payment_updated_at is distinct from old.payment_updated_at or new.payment_updated_by is distinct from old.payment_updated_by or new.payment_updated_name is distinct from old.payment_updated_name or new.payment_revision is distinct from old.payment_revision then raise exception 'Use the admin payment action.';end if;
 end if;
 return new;
end;$function$;

revoke all on function public."guard_invoice_payment"() from public, anon, authenticated, service_role;

grant execute on function public."guard_invoice_payment"() to public;

grant execute on function public."guard_invoice_payment"() to "anon";

grant execute on function public."guard_invoice_payment"() to "authenticated";

grant execute on function public."guard_invoice_payment"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_invoice_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated','anon') then
 if (tg_op='INSERT' and new.invoice_revision<>0) or (tg_op='UPDATE' and new.invoice_revision is distinct from old.invoice_revision) then raise exception 'Use the invoice editor.'; end if;
 end if;
 return new;
end; $function$;

revoke all on function public."guard_invoice_revision"() from public, anon, authenticated, service_role;

grant execute on function public."guard_invoice_revision"() to public;

grant execute on function public."guard_invoice_revision"() to "anon";

grant execute on function public."guard_invoice_revision"() to "authenticated";

grant execute on function public."guard_invoice_revision"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_pickup_line_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target_order uuid; state text;
begin
 if current_user in ('authenticated', 'anon') then
 if tg_op = 'DELETE' then target_order := old.order_id; else target_order := new.order_id; end if;
 -- Serialize line edits with readiness and pickup approval.
 select status::text into state from public.orders where id = target_order for update;
 if state in ('READY', 'COMPLETED', 'CANCELLED') then
 raise exception 'Prepared order quantities can only change through pickup approval.';
 end if;
 if tg_op <> 'INSERT' and public.current_role() <> 'CENTRAL_ADMIN' then
 raise exception 'Only central admin can edit fulfillment quantities.';
 end if;
 if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
 raise exception 'Order lines cannot be moved between orders.';
 end if;
 end if;
 if tg_op = 'DELETE' then return old; end if;
 return new;
end;
$function$;

revoke all on function public."guard_pickup_line_writes"() from public, anon, authenticated, service_role;

grant execute on function public."guard_pickup_line_writes"() to public;

grant execute on function public."guard_pickup_line_writes"() to "anon";

grant execute on function public."guard_pickup_line_writes"() to "authenticated";

grant execute on function public."guard_pickup_line_writes"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_pickup_order_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated', 'anon') then
 if tg_op = 'INSERT' then
 if new.pickup_approval_status is not null then raise exception 'Pickup approval is managed by the pickup workflow.'; end if;
 return new;
 end if;
 if new.pickup_approval_status is distinct from old.pickup_approval_status then
 raise exception 'Pickup approval is managed by the pickup workflow.';
 end if;
 if new.status::text = 'COMPLETED' and old.status::text <> 'COMPLETED' then
 raise exception 'Complete pickup through the pickup confirmation or approval workflow.';
 end if;
 if old.pickup_approval_status = 'PENDING' and new.status is distinct from old.status then
 raise exception 'Review the pending pickup request first.';
 end if;
 if public.current_role() <> 'CENTRAL_ADMIN' and new.status is distinct from old.status
 and not (old.status::text = 'SUBMITTED' and new.status::text = 'CANCELLED') then
 raise exception 'Only central admin can advance preparation status.';
 end if;
 if old.status::text in ('READY', 'COMPLETED') and (
 new.final_subtotal is distinct from old.final_subtotal or
 new.final_tax_amount is distinct from old.final_tax_amount or
 new.final_total_amount is distinct from old.final_total_amount
 ) then raise exception 'Pickup totals are managed by the pickup workflow.'; end if;
 end if;
 return new;
end;
$function$;

revoke all on function public."guard_pickup_order_writes"() from public, anon, authenticated, service_role;

grant execute on function public."guard_pickup_order_writes"() to public;

grant execute on function public."guard_pickup_order_writes"() to "anon";

grant execute on function public."guard_pickup_order_writes"() to "authenticated";

grant execute on function public."guard_pickup_order_writes"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_profile_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated','anon') and public."current_role"() is distinct from 'CENTRAL_ADMIN' then
 if tg_op='INSERT' then raise exception 'Only admin can create profiles.'; end if;
 if new.id is distinct from old.id or new.role is distinct from old.role or new.status is distinct from old.status or new.location_id is distinct from old.location_id or new.email is distinct from old.email then raise exception 'Only admin can change access or branch assignment.'; end if;
 end if;
 if new.role::text='BRANCH_EMPLOYEE' and new.status::text='active' and not exists(select 1 from public.locations where id=new.location_id and is_central is not true) then raise exception 'Assign an active employee to a branch.'; end if;
 return new;
end; $function$;

revoke all on function public."guard_profile_access"() from public, anon, authenticated, service_role;

grant execute on function public."guard_profile_access"() to public;

grant execute on function public."guard_profile_access"() to "anon";

grant execute on function public."guard_profile_access"() to "authenticated";

grant execute on function public."guard_profile_access"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_settled_order_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user in ('authenticated','anon') and (old.status::text in ('READY','COMPLETED') or old.weekly_invoice_id is not null) then raise exception 'Prepared or billed orders cannot be deleted.'; end if;
 return old;
end; $function$;

revoke all on function public."guard_settled_order_delete"() from public, anon, authenticated, service_role;

grant execute on function public."guard_settled_order_delete"() to public;

grant execute on function public."guard_settled_order_delete"() to "anon";

grant execute on function public."guard_settled_order_delete"() to "authenticated";

grant execute on function public."guard_settled_order_delete"() to "service_role";

CREATE OR REPLACE FUNCTION public.guard_weekly_order_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin if current_user in ('authenticated','anon') then if tg_op='INSERT' then if new.weekly_invoice_id is not null or new.pickup_confirmed_by is not null or new.pickup_confirmed_at is not null then raise exception 'Use the invoice or pickup workflow.'; end if; elsif new.weekly_invoice_id is distinct from old.weekly_invoice_id or new.pickup_confirmed_by is distinct from old.pickup_confirmed_by or new.pickup_confirmed_at is distinct from old.pickup_confirmed_at then raise exception 'Use the invoice or pickup workflow.'; end if; end if; return new; end; $function$;

revoke all on function public."guard_weekly_order_link"() from public, anon, authenticated, service_role;

grant execute on function public."guard_weekly_order_link"() to public;

grant execute on function public."guard_weekly_order_link"() to "anon";

grant execute on function public."guard_weekly_order_link"() to "authenticated";

grant execute on function public."guard_weekly_order_link"() to "service_role";

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 insert into public.profiles (id, email, full_name, status)
 values (
 new.id,
 new.email,
 coalesce(new.raw_user_meta_data->>'full_name', ''),
 'pending'
 );
 return new;
end $function$;

revoke all on function public."handle_new_user"() from public, anon, authenticated, service_role;

grant execute on function public."handle_new_user"() to public;

grant execute on function public."handle_new_user"() to "anon";

grant execute on function public."handle_new_user"() to "authenticated";

grant execute on function public."handle_new_user"() to "service_role";

CREATE OR REPLACE FUNCTION public.inventory_day_state(p_branch uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."inventory_day_state"(p_branch uuid, p_date date) from public, anon, authenticated, service_role;

grant execute on function public."inventory_day_state"(p_branch uuid, p_date date) to "service_role";

CREATE OR REPLACE FUNCTION public.inventory_location()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p.location_id from public.profiles p join public.locations l on l.id=p.location_id
 where p.id=auth.uid() and p.status::text='active' and p.role::text in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') and l.is_central is not true;
$function$;

revoke all on function public."inventory_location"() from public, anon, authenticated, service_role;

grant execute on function public."inventory_location"() to "authenticated";

grant execute on function public."inventory_location"() to "service_role";

CREATE OR REPLACE FUNCTION public.invoice_lines_snapshot(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'order_id',l.order_id,'item_id',l.item_id,'quantity',l.quantity,
 'fulfilled_quantity',coalesce(l.invoice_quantity,l.fulfilled_quantity),'unit_price',l.unit_price,
 'is_taxable',coalesce(l.invoice_is_taxable,l.is_taxable),'line_total',l.line_total,'final_line_total',l.invoice_line_total,
 'shortage_reason',l.shortage_reason,'catalog_items',jsonb_build_object('name',c.name,'unit_type',c.unit_type)) order by l.id),'[]'::jsonb)
 from public.order_lines l left join public.catalog_items c on c.id=l.item_id where l.order_id=p_order_id;
$function$;

revoke all on function public."invoice_lines_snapshot"(p_order_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."invoice_lines_snapshot"(p_order_id uuid) to "authenticated";

grant execute on function public."invoice_lines_snapshot"(p_order_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.normalize_catering_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
 begin
 if new.status::text='CONFIRMED' and (new.event_datetime at time zone 'America/Toronto')::date<(now() at time zone 'America/Toronto')::date then new.status:='COMPLETED';end if;
 return new;
 end; $function$;

revoke all on function public."normalize_catering_status"() from public, anon, authenticated, service_role;

grant execute on function public."normalize_catering_status"() to public;

grant execute on function public."normalize_catering_status"() to "anon";

grant execute on function public."normalize_catering_status"() to "authenticated";

grant execute on function public."normalize_catering_status"() to "service_role";

CREATE OR REPLACE FUNCTION public.recalc_final_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target uuid:=coalesce(new.order_id,old.order_id); sub numeric; tax numeric;
begin
 select coalesce(sum(invoice_line_total),0),coalesce(sum(case when coalesce(invoice_is_taxable,is_taxable) then invoice_line_total*0.13 else 0 end),0)
 into sub,tax from public.order_lines where order_id=target;
 update public.orders set final_subtotal=sub,final_tax_amount=tax,final_total_amount=sub+tax,updated_at=clock_timestamp() where id=target;
 return null;
end; $function$;

revoke all on function public."recalc_final_order_totals"() from public, anon, authenticated, service_role;

grant execute on function public."recalc_final_order_totals"() to public;

grant execute on function public."recalc_final_order_totals"() to "anon";

grant execute on function public."recalc_final_order_totals"() to "authenticated";

grant execute on function public."recalc_final_order_totals"() to "service_role";

CREATE OR REPLACE FUNCTION public.receive_pickup_return(p_request_id uuid, p_note text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."receive_pickup_return"(p_request_id uuid, p_note text) from public, anon, authenticated, service_role;

grant execute on function public."receive_pickup_return"(p_request_id uuid, p_note text) to "authenticated";

grant execute on function public."receive_pickup_return"(p_request_id uuid, p_note text) to "service_role";

CREATE OR REPLACE FUNCTION public.remove_catalog_item(p_item_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles%rowtype; product public.catalog_items%rowtype;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role::text is distinct from 'CENTRAL_ADMIN' or actor.status::text is distinct from 'active' then raise exception 'Only an active central admin can remove catalog items.';end if;
 select * into product from public.catalog_items where id=p_item_id for update;
 if not found then raise exception 'This catalog item is no longer available.';end if;
 if exists(select 1 from public.order_lines where item_id=p_item_id)
 or exists(select 1 from public.pickup_request_lines where item_id=p_item_id)
 or exists(select 1 from public.branch_inventory_lines where item_id=p_item_id) then
 update public.catalog_items set archived_at=coalesce(archived_at,clock_timestamp()),is_active=false where id=p_item_id;
 return 'archived';
 end if;
 begin
 delete from public.catalog_items where id=p_item_id;
 exception when foreign_key_violation then
 update public.catalog_items set archived_at=coalesce(archived_at,clock_timestamp()),is_active=false where id=p_item_id;
 return 'archived';
 end;
 return 'deleted';
end; $function$;

revoke all on function public."remove_catalog_item"(p_item_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."remove_catalog_item"(p_item_id uuid) to "authenticated";

grant execute on function public."remove_catalog_item"(p_item_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.reserve_receipt_scan(p_receipt_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 month_key text :=
 to_char(now() at time zone 'UTC', 'YYYY-MM');

 user_day_key text :=
 p_user_id::text || ':' ||
 to_char(
 now() at time zone 'America/Toronto',
 'YYYY-MM-DD'
 );
begin
 -- Serialize requests so simultaneous scans cannot bypass limits.
 perform pg_advisory_xact_lock(730030003);

 if not exists (
 select 1
 from public.profiles
 where id = p_user_id
 and role = 'CENTRAL_ADMIN'
 and status = 'active'
 ) then
 return false;
 end if;

 if (
 select coalesce(
 sum((scan_usage ->> month_key)::integer), 0
 )
 from public.purchase_receipts
 ) >= 200
 or (
 select coalesce(
 sum((scan_usage ->> user_day_key)::integer), 0
 )
 from public.purchase_receipts
 ) >= 10
 or exists (
 select 1
 from public.purchase_receipts
 where scan_started_at > now() - interval '5 seconds'
 )
 or exists (
 select 1
 from public.purchase_receipts
 where id = p_receipt_id
 and scan_status = 'RUNNING'
 and scan_started_at > now() - interval '1 hour'
 ) then
 return false;
 end if;

 update public.purchase_receipts
 set
 scan_usage = jsonb_set(
 jsonb_set(
 scan_usage,
 array[month_key],
 to_jsonb(
 coalesce((scan_usage ->> month_key)::integer, 0) + 1
 )
 ),
 array[user_day_key],
 to_jsonb(
 coalesce((scan_usage ->> user_day_key)::integer, 0) + 1
 )
 ),
 scan_status = 'RUNNING',
 scan_started_at = now(),
 operation_url = null
 where id = p_receipt_id;

 return found;
end;
$function$;

revoke all on function public."reserve_receipt_scan"(p_receipt_id uuid, p_user_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."reserve_receipt_scan"(p_receipt_id uuid, p_user_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.review_pickup(p_request_id uuid, p_approve boolean, p_note text DEFAULT ''::text, p_returns jsonb DEFAULT '{}'::jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."review_pickup"(p_request_id uuid, p_approve boolean, p_note text, p_returns jsonb) from public, anon, authenticated, service_role;

grant execute on function public."review_pickup"(p_request_id uuid, p_approve boolean, p_note text, p_returns jsonb) to "authenticated";

grant execute on function public."review_pickup"(p_request_id uuid, p_approve boolean, p_note text, p_returns jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 cmd record;
BEGIN
 FOR cmd IN
 SELECT *
 FROM pg_event_trigger_ddl_commands()
 WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
 AND object_type IN ('table','partitioned table')
 LOOP
 IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
 BEGIN
 EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
 RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
 EXCEPTION
 WHEN OTHERS THEN
 RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
 END;
 ELSE
 RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
 END IF;
 END LOOP;
END;
$function$;

revoke all on function public."rls_auto_enable"() from public, anon, authenticated, service_role;

grant execute on function public."rls_auto_enable"() to public;

grant execute on function public."rls_auto_enable"() to "anon";

grant execute on function public."rls_auto_enable"() to "authenticated";

grant execute on function public."rls_auto_enable"() to "service_role";

CREATE OR REPLACE FUNCTION public.save_branch_inventory_day(p_count_date date, p_lines jsonb, p_notes text DEFAULT ''::text, p_expected_count_id uuid DEFAULT NULL::uuid, p_expected_previous_count_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."save_branch_inventory_day"(p_count_date date, p_lines jsonb, p_notes text, p_expected_count_id uuid, p_expected_previous_count_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."save_branch_inventory_day"(p_count_date date, p_lines jsonb, p_notes text, p_expected_count_id uuid, p_expected_previous_count_id uuid) to "authenticated";

grant execute on function public."save_branch_inventory_day"(p_count_date date, p_lines jsonb, p_notes text, p_expected_count_id uuid, p_expected_previous_count_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.save_daily_stock(p_updates jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare proposal jsonb; item public.catalog_items%rowtype; quantity numeric; expected numeric; total integer;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can save stock.'; end if;
 if jsonb_typeof(p_updates) is distinct from 'array' or jsonb_array_length(p_updates) = 0 then raise exception 'Provide at least one stock update.'; end if;
 total := jsonb_array_length(p_updates);
 if (select count(distinct value->>'id') from jsonb_array_elements(p_updates)) <> total then raise exception 'Each stock item must appear once.'; end if;
 for proposal in select value from jsonb_array_elements(p_updates) order by value->>'id' loop
 if jsonb_typeof(proposal->'available_stock') is distinct from 'number' or jsonb_typeof(proposal->'expected_stock') is distinct from 'number'
 or not (proposal ? 'expected_updated_at') then raise exception 'Invalid stock update.'; end if;
 quantity := (proposal->>'available_stock')::numeric;
 expected := (proposal->>'expected_stock')::numeric;
 if quantity < 0 or quantity > 2147483647 or quantity <> trunc(quantity) then raise exception 'Stock must be a nonnegative whole number.'; end if;
 select * into item from public.catalog_items where id = (proposal->>'id')::uuid for update;
 if not found or item.is_active is distinct from true then raise exception 'A stock item is missing or inactive.'; end if;
 if item.available_stock is distinct from expected or item.updated_at is distinct from (proposal->>'expected_updated_at')::timestamptz then
 raise exception 'Stock changed while you were editing. No items were saved. Discard edits and refresh before trying again.';
 end if;
 update public.catalog_items set available_stock = quantity::integer, updated_at = clock_timestamp() where id = item.id;
 end loop;
 return total;
end;
$function$;

revoke all on function public."save_daily_stock"(p_updates jsonb) from public, anon, authenticated, service_role;

grant execute on function public."save_daily_stock"(p_updates jsonb) to "authenticated";

grant execute on function public."save_daily_stock"(p_updates jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.send_weekly_invoice(p_invoice_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invoice public.weekly_invoices%rowtype; payload jsonb; stamp timestamptz;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can send weekly invoices.'; end if;
 -- Lock linked orders before the invoice, matching the edit lock order.
 perform 1 from public.orders where weekly_invoice_id=p_invoice_id order by id for update;
 select * into invoice from public.weekly_invoices where id=p_invoice_id for update;
 if not found then raise exception 'Weekly invoice not found.'; end if;
 if invoice.sent_revision=invoice.revision then return invoice.sent_at; end if;
 if exists(select 1 from public.orders o where o.weekly_invoice_id=invoice.id and (o.status::text is distinct from 'COMPLETED' or o.pickup_approval_status='PENDING' or exists(select 1 from public.pickup_requests r where r.order_id=o.id and r.return_status='PENDING'))) then raise exception 'Resolve pending pickup approvals or returns before sending.'; end if;
 payload:=public.weekly_invoice_details(invoice.id,true); stamp:=clock_timestamp(); payload:=payload||jsonb_build_object('sent_at',stamp);
 insert into public.weekly_invoice_publications(weekly_invoice_id,revision,published_by,snapshot) values(invoice.id,invoice.revision,auth.uid(),payload);
 update public.weekly_invoices set sent_revision=revision,sent_at=stamp,sent_by=auth.uid() where id=invoice.id;
 return stamp;
end; $function$;

revoke all on function public."send_weekly_invoice"(p_invoice_id uuid) from public, anon, authenticated, service_role;

grant execute on function public."send_weekly_invoice"(p_invoice_id uuid) to "authenticated";

grant execute on function public."send_weekly_invoice"(p_invoice_id uuid) to "service_role";

CREATE OR REPLACE FUNCTION public.set_invoice_payment_status(p_invoice_id uuid, p_status text, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invoice public.weekly_invoices%rowtype; stamp timestamptz; actor_name text;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active central admin can update payment status.';end if;
 if p_status is null or p_status not in ('UNPAID','PAID') then raise exception 'Choose Unpaid or Paid.';end if;
 select * into invoice from public.weekly_invoices where id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found.';end if;
 if invoice.payment_updated_at is distinct from p_expected_updated_at then raise exception 'Payment status changed. Refresh before updating it.';end if;
 if invoice.payment_status=p_status and (p_status='UNPAID' or invoice.payment_revision=invoice.revision) then return invoice.payment_updated_at;end if;
 select full_name into actor_name from public.profiles where id=auth.uid();stamp:=clock_timestamp();
 update public.weekly_invoices set payment_status=p_status,payment_updated_at=stamp,payment_updated_by=auth.uid(),payment_updated_name=actor_name,payment_revision=case when p_status='PAID' then revision else null end where id=invoice.id;
 return stamp;
end;$function$;

revoke all on function public."set_invoice_payment_status"(p_invoice_id uuid, p_status text, p_expected_updated_at timestamp with time zone) from public, anon, authenticated, service_role;

grant execute on function public."set_invoice_payment_status"(p_invoice_id uuid, p_status text, p_expected_updated_at timestamp with time zone) to "authenticated";

grant execute on function public."set_invoice_payment_status"(p_invoice_id uuid, p_status text, p_expected_updated_at timestamp with time zone) to "service_role";

CREATE OR REPLACE FUNCTION public.submit_pickup(p_order_id uuid, p_quantities jsonb, p_reason text DEFAULT ''::text, p_already_collected boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

revoke all on function public."submit_pickup"(p_order_id uuid, p_quantities jsonb, p_reason text, p_already_collected boolean) from public, anon, authenticated, service_role;

grant execute on function public."submit_pickup"(p_order_id uuid, p_quantities jsonb, p_reason text, p_already_collected boolean) to "authenticated";

grant execute on function public."submit_pickup"(p_order_id uuid, p_quantities jsonb, p_reason text, p_already_collected boolean) to "service_role";

CREATE OR REPLACE FUNCTION public.validate_catalog_options()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op='INSERT' or new.category is distinct from old.category then
 if not exists(select 1 from public.catalog_categories where name=new.category and (is_active or pg_trigger_depth()>1)) then raise exception 'Choose an active category.';end if;
 end if;
 if tg_op='INSERT' or new.unit_type is distinct from old.unit_type then
 if not exists(select 1 from public.catalog_units where name=new.unit_type and (is_active or pg_trigger_depth()>1)) then raise exception 'Choose an active unit.';end if;
 end if;
 update public.catalog_categories set ever_used=true where name=new.category and not ever_used;
 update public.catalog_units set ever_used=true where name=new.unit_type and not ever_used;
 return new;
end;$function$;

revoke all on function public."validate_catalog_options"() from public, anon, authenticated, service_role;

grant execute on function public."validate_catalog_options"() to public;

grant execute on function public."validate_catalog_options"() to "anon";

grant execute on function public."validate_catalog_options"() to "authenticated";

grant execute on function public."validate_catalog_options"() to "service_role";

CREATE OR REPLACE FUNCTION public.weekly_invoice_details(p_invoice_id uuid, p_live boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare invoice public.weekly_invoices%rowtype; payload jsonb; entries jsonb; orders_json jsonb;
begin
 select * into invoice from public.weekly_invoices where id=p_invoice_id;
 if not found or (public."current_role"() is distinct from 'CENTRAL_ADMIN' and (invoice.location_id is distinct from public.current_location() or invoice.sent_at is null)) then raise exception 'Invoice not accessible.'; end if;
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' or not p_live then
 select snapshot into payload from public.weekly_invoice_publications where weekly_invoice_id=invoice.id order by revision desc limit 1;
 if payload is not null then return payload; end if;
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Invoice has not been sent.'; end if;
 end if;
 select coalesce(jsonb_agg(row_data),'[]') into entries from (
 select jsonb_build_object('item_id',l.item_id,'name',c.name,'unit_type',c.unit_type,'unit_price',l.unit_price,
 'is_taxable',coalesce(l.invoice_is_taxable,l.is_taxable),'quantity',sum(coalesce(l.invoice_quantity,l.fulfilled_quantity)),
 'subtotal',sum(l.invoice_line_total),'tax',round(sum(case when coalesce(l.invoice_is_taxable,l.is_taxable) then l.invoice_line_total*0.13 else 0 end),2)) row_data
 from public.order_lines l join public.orders o on o.id=l.order_id left join public.catalog_items c on c.id=l.item_id
 where o.weekly_invoice_id=invoice.id group by l.item_id,c.name,c.unit_type,l.unit_price,coalesce(l.invoice_is_taxable,l.is_taxable) order by c.name,l.unit_price
 ) grouped;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'order_number',order_number,'order_date',order_date,'total',final_total_amount) order by order_date,order_number),'[]') into orders_json from public.orders where weekly_invoice_id=invoice.id;
 select jsonb_build_object('id',invoice.id,'location_id',invoice.location_id,'branch_name',(select name from public.locations where id=invoice.location_id),
 'start_date',invoice.start_date,'end_date',invoice.end_date,'revision',invoice.revision,'sent_at',invoice.sent_at,'lines',entries,'orders',orders_json,
 'subtotal',coalesce(sum(final_subtotal),0),'tax',coalesce(sum(final_tax_amount),0),'total',coalesce(sum(final_total_amount),0)) into payload
 from public.orders where weekly_invoice_id=invoice.id;
 return payload;
end; $function$;

revoke all on function public."weekly_invoice_details"(p_invoice_id uuid, p_live boolean) from public, anon, authenticated, service_role;

grant execute on function public."weekly_invoice_details"(p_invoice_id uuid, p_live boolean) to "authenticated";

grant execute on function public."weekly_invoice_details"(p_invoice_id uuid, p_live boolean) to "service_role";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER guard_used_category BEFORE DELETE ON catalog_categories FOR EACH ROW EXECUTE FUNCTION guard_catalog_option_delete();

CREATE TRIGGER guard_catalog_history_delete BEFORE DELETE ON catalog_items FOR EACH ROW EXECUTE FUNCTION guard_catalog_history_delete();

CREATE TRIGGER validate_catalog_options BEFORE INSERT OR UPDATE OF category, unit_type ON catalog_items FOR EACH ROW EXECUTE FUNCTION validate_catalog_options();

CREATE TRIGGER guard_used_unit BEFORE DELETE ON catalog_units FOR EACH ROW EXECUTE FUNCTION guard_catalog_option_delete();

CREATE TRIGGER normalize_catering_status BEFORE INSERT OR UPDATE OF status, event_datetime ON catering_events FOR EACH ROW EXECUTE FUNCTION normalize_catering_status();

CREATE TRIGGER order_lines_guard_billing BEFORE INSERT OR UPDATE ON order_lines FOR EACH ROW EXECUTE FUNCTION guard_billing_fields();

CREATE TRIGGER order_lines_guard_pickup BEFORE INSERT OR DELETE OR UPDATE ON order_lines FOR EACH ROW EXECUTE FUNCTION guard_pickup_line_writes();

CREATE TRIGGER trg_default_fulfilled BEFORE INSERT ON order_lines FOR EACH ROW EXECUTE FUNCTION default_fulfilled_qty();

CREATE TRIGGER trg_recalc_final_totals AFTER INSERT OR DELETE OR UPDATE ON order_lines FOR EACH ROW EXECUTE FUNCTION recalc_final_order_totals();

CREATE TRIGGER orders_deduct_stock_when_ready BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION deduct_stock_when_order_ready();

CREATE TRIGGER orders_guard_invoice_revision BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION guard_invoice_revision();

CREATE TRIGGER orders_guard_pickup BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION guard_pickup_order_writes();

CREATE TRIGGER orders_guard_weekly BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION guard_weekly_order_link();

CREATE TRIGGER orders_keep_history BEFORE DELETE ON orders FOR EACH ROW EXECUTE FUNCTION guard_settled_order_delete();

CREATE TRIGGER profiles_guard_access BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_access();

CREATE TRIGGER weekly_invoice_guard_payment BEFORE INSERT OR UPDATE ON weekly_invoices FOR EACH ROW EXECUTE FUNCTION guard_invoice_payment();

revoke all on table public."branch_inventory_counts" from public, anon, authenticated, service_role;

alter table public."branch_inventory_counts" enable row level security;

revoke all on table public."branch_inventory_lines" from public, anon, authenticated, service_role;

alter table public."branch_inventory_lines" enable row level security;

revoke all on table public."catalog_categories" from public, anon, authenticated, service_role;

alter table public."catalog_categories" enable row level security;

revoke all on table public."catalog_items" from public, anon, authenticated, service_role;

alter table public."catalog_items" enable row level security;

revoke all on table public."catalog_units" from public, anon, authenticated, service_role;

alter table public."catalog_units" enable row level security;

revoke all on table public."catering_events" from public, anon, authenticated, service_role;

alter table public."catering_events" enable row level security;

revoke all on table public."invoice_edits" from public, anon, authenticated, service_role;

alter table public."invoice_edits" enable row level security;

revoke all on table public."locations" from public, anon, authenticated, service_role;

alter table public."locations" enable row level security;

revoke all on table public."order_lines" from public, anon, authenticated, service_role;

alter table public."order_lines" enable row level security;

revoke all on table public."orders" from public, anon, authenticated, service_role;

alter table public."orders" enable row level security;

revoke all on table public."pickup_request_lines" from public, anon, authenticated, service_role;

alter table public."pickup_request_lines" enable row level security;

revoke all on table public."pickup_requests" from public, anon, authenticated, service_role;

alter table public."pickup_requests" enable row level security;

revoke all on table public."profiles" from public, anon, authenticated, service_role;

alter table public."profiles" enable row level security;

revoke all on table public."purchase_receipts" from public, anon, authenticated, service_role;

alter table public."purchase_receipts" enable row level security;

revoke all on table public."weekly_invoice_publications" from public, anon, authenticated, service_role;

alter table public."weekly_invoice_publications" enable row level security;

revoke all on table public."weekly_invoices" from public, anon, authenticated, service_role;

alter table public."weekly_invoices" enable row level security;

create policy "inventory_counts_read" on public."branch_inventory_counts" as PERMISSIVE for SELECT to "authenticated" using ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (location_id = inventory_location())));

create policy "inventory_lines_read" on public."branch_inventory_lines" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM branch_inventory_counts c
 WHERE (c.id = branch_inventory_lines.count_id))));

create policy "category_admin" on public."catalog_categories" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'CENTRAL_ADMIN'::text) AND ((profiles.status)::text = 'active'::text))))) with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'CENTRAL_ADMIN'::text) AND ((profiles.status)::text = 'active'::text)))));

create policy "category_read" on public."catalog_categories" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.status)::text = 'active'::text)))));

create policy "Allow catalog read" on public."catalog_items" as PERMISSIVE for SELECT to "authenticated" using (("current_role"() = ANY (ARRAY['CENTRAL_ADMIN'::text, 'BRANCH_MANAGER'::text])));

create policy "catalog_write" on public."catalog_items" as PERMISSIVE for ALL to "authenticated" using (("current_role"() = 'CENTRAL_ADMIN'::text)) with check (("current_role"() = 'CENTRAL_ADMIN'::text));

create policy "unit_admin" on public."catalog_units" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'CENTRAL_ADMIN'::text) AND ((profiles.status)::text = 'active'::text))))) with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'CENTRAL_ADMIN'::text) AND ((profiles.status)::text = 'active'::text)))));

create policy "unit_read" on public."catalog_units" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND ((profiles.status)::text = 'active'::text)))));

create policy "branch_employee_catering" on public."catering_events" as PERMISSIVE for ALL to "authenticated" using (((location_id = inventory_location()) AND (EXISTS ( SELECT 1
 FROM profiles p
 WHERE ((p.id = auth.uid()) AND ((p.role)::text = 'BRANCH_EMPLOYEE'::text) AND ((p.status)::text = 'active'::text)))))) with check (((location_id = inventory_location()) AND (EXISTS ( SELECT 1
 FROM profiles p
 WHERE ((p.id = auth.uid()) AND ((p.role)::text = 'BRANCH_EMPLOYEE'::text) AND ((p.status)::text = 'active'::text))))));

create policy "catering_access" on public."catering_events" as PERMISSIVE for ALL to "authenticated" using ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (location_id = current_location()))) with check ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (location_id = current_location())));

create policy "invoice_edits_admin_read" on public."invoice_edits" as PERMISSIVE for SELECT to "authenticated" using (("current_role"() = 'CENTRAL_ADMIN'::text));

create policy "Allow read access to locations for authenticated users" on public."locations" as PERMISSIVE for SELECT to "authenticated" using ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (id = current_location()) OR (id = inventory_location())));

create policy "locations_write" on public."locations" as PERMISSIVE for ALL to "authenticated" using (("current_role"() = 'CENTRAL_ADMIN'::text)) with check (("current_role"() = 'CENTRAL_ADMIN'::text));

create policy "order_lines_access" on public."order_lines" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
 FROM orders o
 WHERE ((o.id = order_lines.order_id) AND (("current_role"() = 'CENTRAL_ADMIN'::text) OR (o.location_id = current_location())))))) with check ((EXISTS ( SELECT 1
 FROM orders o
 WHERE ((o.id = order_lines.order_id) AND (("current_role"() = 'CENTRAL_ADMIN'::text) OR (o.location_id = current_location()))))));

create policy "orders_access" on public."orders" as PERMISSIVE for ALL to "authenticated" using ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (location_id = current_location()))) with check ((("current_role"() = 'CENTRAL_ADMIN'::text) OR (location_id = current_location())));

create policy "pickup_request_lines_read" on public."pickup_request_lines" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM pickup_requests r
 WHERE (r.id = pickup_request_lines.request_id))));

create policy "pickup_requests_read" on public."pickup_requests" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM orders o
 WHERE ((o.id = pickup_requests.order_id) AND (("current_role"() = 'CENTRAL_ADMIN'::text) OR (o.location_id = current_location()))))));

create policy "profiles_admin_update" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (("current_role"() = 'CENTRAL_ADMIN'::text)) with check (("current_role"() = 'CENTRAL_ADMIN'::text));

create policy "profiles_read" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (((id = auth.uid()) OR ("current_role"() = 'CENTRAL_ADMIN'::text)));

create policy "profiles_self_update" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));

create policy "purchase_receipts_admin_read" on public."purchase_receipts" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'CENTRAL_ADMIN'::user_role) AND (profiles.status = 'active'::profile_status)))));

create policy "weekly_publication_read" on public."weekly_invoice_publications" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
 FROM weekly_invoices w
 WHERE (w.id = weekly_invoice_publications.weekly_invoice_id))));

create policy "weekly_invoice_read" on public."weekly_invoices" as PERMISSIVE for SELECT to "authenticated" using ((("current_role"() = 'CENTRAL_ADMIN'::text) OR ((location_id = current_location()) AND (sent_at IS NOT NULL))));

grant SELECT on table public."branch_inventory_counts" to "authenticated";

grant DELETE on table public."branch_inventory_counts" to "service_role";

grant INSERT on table public."branch_inventory_counts" to "service_role";

grant REFERENCES on table public."branch_inventory_counts" to "service_role";

grant SELECT on table public."branch_inventory_counts" to "service_role";

grant TRIGGER on table public."branch_inventory_counts" to "service_role";

grant TRUNCATE on table public."branch_inventory_counts" to "service_role";

grant UPDATE on table public."branch_inventory_counts" to "service_role";

grant SELECT on table public."branch_inventory_lines" to "authenticated";

grant DELETE on table public."branch_inventory_lines" to "service_role";

grant INSERT on table public."branch_inventory_lines" to "service_role";

grant REFERENCES on table public."branch_inventory_lines" to "service_role";

grant SELECT on table public."branch_inventory_lines" to "service_role";

grant TRIGGER on table public."branch_inventory_lines" to "service_role";

grant TRUNCATE on table public."branch_inventory_lines" to "service_role";

grant UPDATE on table public."branch_inventory_lines" to "service_role";

grant DELETE on table public."catalog_categories" to "authenticated";

grant SELECT on table public."catalog_categories" to "authenticated";

grant DELETE on table public."catalog_categories" to "service_role";

grant INSERT on table public."catalog_categories" to "service_role";

grant REFERENCES on table public."catalog_categories" to "service_role";

grant SELECT on table public."catalog_categories" to "service_role";

grant TRIGGER on table public."catalog_categories" to "service_role";

grant TRUNCATE on table public."catalog_categories" to "service_role";

grant UPDATE on table public."catalog_categories" to "service_role";

grant DELETE on table public."catalog_items" to "anon";

grant INSERT on table public."catalog_items" to "anon";

grant REFERENCES on table public."catalog_items" to "anon";

grant SELECT on table public."catalog_items" to "anon";

grant TRIGGER on table public."catalog_items" to "anon";

grant TRUNCATE on table public."catalog_items" to "anon";

grant UPDATE on table public."catalog_items" to "anon";

grant DELETE on table public."catalog_items" to "authenticated";

grant INSERT on table public."catalog_items" to "authenticated";

grant REFERENCES on table public."catalog_items" to "authenticated";

grant SELECT on table public."catalog_items" to "authenticated";

grant TRIGGER on table public."catalog_items" to "authenticated";

grant TRUNCATE on table public."catalog_items" to "authenticated";

grant UPDATE on table public."catalog_items" to "authenticated";

grant DELETE on table public."catalog_items" to "service_role";

grant INSERT on table public."catalog_items" to "service_role";

grant REFERENCES on table public."catalog_items" to "service_role";

grant SELECT on table public."catalog_items" to "service_role";

grant TRIGGER on table public."catalog_items" to "service_role";

grant TRUNCATE on table public."catalog_items" to "service_role";

grant UPDATE on table public."catalog_items" to "service_role";

grant DELETE on table public."catalog_units" to "authenticated";

grant SELECT on table public."catalog_units" to "authenticated";

grant DELETE on table public."catalog_units" to "service_role";

grant INSERT on table public."catalog_units" to "service_role";

grant REFERENCES on table public."catalog_units" to "service_role";

grant SELECT on table public."catalog_units" to "service_role";

grant TRIGGER on table public."catalog_units" to "service_role";

grant TRUNCATE on table public."catalog_units" to "service_role";

grant UPDATE on table public."catalog_units" to "service_role";

grant DELETE on table public."catering_events" to "anon";

grant INSERT on table public."catering_events" to "anon";

grant REFERENCES on table public."catering_events" to "anon";

grant SELECT on table public."catering_events" to "anon";

grant TRIGGER on table public."catering_events" to "anon";

grant TRUNCATE on table public."catering_events" to "anon";

grant UPDATE on table public."catering_events" to "anon";

grant DELETE on table public."catering_events" to "authenticated";

grant INSERT on table public."catering_events" to "authenticated";

grant REFERENCES on table public."catering_events" to "authenticated";

grant SELECT on table public."catering_events" to "authenticated";

grant TRIGGER on table public."catering_events" to "authenticated";

grant TRUNCATE on table public."catering_events" to "authenticated";

grant UPDATE on table public."catering_events" to "authenticated";

grant DELETE on table public."catering_events" to "service_role";

grant INSERT on table public."catering_events" to "service_role";

grant REFERENCES on table public."catering_events" to "service_role";

grant SELECT on table public."catering_events" to "service_role";

grant TRIGGER on table public."catering_events" to "service_role";

grant TRUNCATE on table public."catering_events" to "service_role";

grant UPDATE on table public."catering_events" to "service_role";

grant DELETE on table public."invoice_edits" to "anon";

grant INSERT on table public."invoice_edits" to "anon";

grant REFERENCES on table public."invoice_edits" to "anon";

grant SELECT on table public."invoice_edits" to "anon";

grant TRIGGER on table public."invoice_edits" to "anon";

grant TRUNCATE on table public."invoice_edits" to "anon";

grant UPDATE on table public."invoice_edits" to "anon";

grant DELETE on table public."invoice_edits" to "authenticated";

grant INSERT on table public."invoice_edits" to "authenticated";

grant REFERENCES on table public."invoice_edits" to "authenticated";

grant SELECT on table public."invoice_edits" to "authenticated";

grant TRIGGER on table public."invoice_edits" to "authenticated";

grant TRUNCATE on table public."invoice_edits" to "authenticated";

grant UPDATE on table public."invoice_edits" to "authenticated";

grant DELETE on table public."invoice_edits" to "service_role";

grant INSERT on table public."invoice_edits" to "service_role";

grant REFERENCES on table public."invoice_edits" to "service_role";

grant SELECT on table public."invoice_edits" to "service_role";

grant TRIGGER on table public."invoice_edits" to "service_role";

grant TRUNCATE on table public."invoice_edits" to "service_role";

grant UPDATE on table public."invoice_edits" to "service_role";

grant DELETE on table public."locations" to "anon";

grant INSERT on table public."locations" to "anon";

grant REFERENCES on table public."locations" to "anon";

grant SELECT on table public."locations" to "anon";

grant TRIGGER on table public."locations" to "anon";

grant TRUNCATE on table public."locations" to "anon";

grant UPDATE on table public."locations" to "anon";

grant DELETE on table public."locations" to "authenticated";

grant INSERT on table public."locations" to "authenticated";

grant REFERENCES on table public."locations" to "authenticated";

grant SELECT on table public."locations" to "authenticated";

grant TRIGGER on table public."locations" to "authenticated";

grant TRUNCATE on table public."locations" to "authenticated";

grant UPDATE on table public."locations" to "authenticated";

grant DELETE on table public."locations" to "service_role";

grant INSERT on table public."locations" to "service_role";

grant REFERENCES on table public."locations" to "service_role";

grant SELECT on table public."locations" to "service_role";

grant TRIGGER on table public."locations" to "service_role";

grant TRUNCATE on table public."locations" to "service_role";

grant UPDATE on table public."locations" to "service_role";

grant DELETE on table public."order_lines" to "anon";

grant INSERT on table public."order_lines" to "anon";

grant REFERENCES on table public."order_lines" to "anon";

grant SELECT on table public."order_lines" to "anon";

grant TRIGGER on table public."order_lines" to "anon";

grant TRUNCATE on table public."order_lines" to "anon";

grant UPDATE on table public."order_lines" to "anon";

grant DELETE on table public."order_lines" to "authenticated";

grant INSERT on table public."order_lines" to "authenticated";

grant REFERENCES on table public."order_lines" to "authenticated";

grant SELECT on table public."order_lines" to "authenticated";

grant TRIGGER on table public."order_lines" to "authenticated";

grant TRUNCATE on table public."order_lines" to "authenticated";

grant UPDATE on table public."order_lines" to "authenticated";

grant DELETE on table public."order_lines" to "service_role";

grant INSERT on table public."order_lines" to "service_role";

grant REFERENCES on table public."order_lines" to "service_role";

grant SELECT on table public."order_lines" to "service_role";

grant TRIGGER on table public."order_lines" to "service_role";

grant TRUNCATE on table public."order_lines" to "service_role";

grant UPDATE on table public."order_lines" to "service_role";

grant DELETE on table public."orders" to "anon";

grant INSERT on table public."orders" to "anon";

grant REFERENCES on table public."orders" to "anon";

grant SELECT on table public."orders" to "anon";

grant TRIGGER on table public."orders" to "anon";

grant TRUNCATE on table public."orders" to "anon";

grant UPDATE on table public."orders" to "anon";

grant DELETE on table public."orders" to "authenticated";

grant INSERT on table public."orders" to "authenticated";

grant REFERENCES on table public."orders" to "authenticated";

grant SELECT on table public."orders" to "authenticated";

grant TRIGGER on table public."orders" to "authenticated";

grant TRUNCATE on table public."orders" to "authenticated";

grant UPDATE on table public."orders" to "authenticated";

grant DELETE on table public."orders" to "service_role";

grant INSERT on table public."orders" to "service_role";

grant REFERENCES on table public."orders" to "service_role";

grant SELECT on table public."orders" to "service_role";

grant TRIGGER on table public."orders" to "service_role";

grant TRUNCATE on table public."orders" to "service_role";

grant UPDATE on table public."orders" to "service_role";

grant DELETE on table public."pickup_request_lines" to "anon";

grant INSERT on table public."pickup_request_lines" to "anon";

grant REFERENCES on table public."pickup_request_lines" to "anon";

grant SELECT on table public."pickup_request_lines" to "anon";

grant TRIGGER on table public."pickup_request_lines" to "anon";

grant TRUNCATE on table public."pickup_request_lines" to "anon";

grant UPDATE on table public."pickup_request_lines" to "anon";

grant DELETE on table public."pickup_request_lines" to "authenticated";

grant INSERT on table public."pickup_request_lines" to "authenticated";

grant REFERENCES on table public."pickup_request_lines" to "authenticated";

grant SELECT on table public."pickup_request_lines" to "authenticated";

grant TRIGGER on table public."pickup_request_lines" to "authenticated";

grant TRUNCATE on table public."pickup_request_lines" to "authenticated";

grant UPDATE on table public."pickup_request_lines" to "authenticated";

grant DELETE on table public."pickup_request_lines" to "service_role";

grant INSERT on table public."pickup_request_lines" to "service_role";

grant REFERENCES on table public."pickup_request_lines" to "service_role";

grant SELECT on table public."pickup_request_lines" to "service_role";

grant TRIGGER on table public."pickup_request_lines" to "service_role";

grant TRUNCATE on table public."pickup_request_lines" to "service_role";

grant UPDATE on table public."pickup_request_lines" to "service_role";

grant DELETE on table public."pickup_requests" to "anon";

grant INSERT on table public."pickup_requests" to "anon";

grant REFERENCES on table public."pickup_requests" to "anon";

grant SELECT on table public."pickup_requests" to "anon";

grant TRIGGER on table public."pickup_requests" to "anon";

grant TRUNCATE on table public."pickup_requests" to "anon";

grant UPDATE on table public."pickup_requests" to "anon";

grant DELETE on table public."pickup_requests" to "authenticated";

grant INSERT on table public."pickup_requests" to "authenticated";

grant REFERENCES on table public."pickup_requests" to "authenticated";

grant SELECT on table public."pickup_requests" to "authenticated";

grant TRIGGER on table public."pickup_requests" to "authenticated";

grant TRUNCATE on table public."pickup_requests" to "authenticated";

grant UPDATE on table public."pickup_requests" to "authenticated";

grant DELETE on table public."pickup_requests" to "service_role";

grant INSERT on table public."pickup_requests" to "service_role";

grant REFERENCES on table public."pickup_requests" to "service_role";

grant SELECT on table public."pickup_requests" to "service_role";

grant TRIGGER on table public."pickup_requests" to "service_role";

grant TRUNCATE on table public."pickup_requests" to "service_role";

grant UPDATE on table public."pickup_requests" to "service_role";

grant DELETE on table public."profiles" to "anon";

grant INSERT on table public."profiles" to "anon";

grant REFERENCES on table public."profiles" to "anon";

grant SELECT on table public."profiles" to "anon";

grant TRIGGER on table public."profiles" to "anon";

grant TRUNCATE on table public."profiles" to "anon";

grant UPDATE on table public."profiles" to "anon";

grant DELETE on table public."profiles" to "authenticated";

grant INSERT on table public."profiles" to "authenticated";

grant REFERENCES on table public."profiles" to "authenticated";

grant SELECT on table public."profiles" to "authenticated";

grant TRIGGER on table public."profiles" to "authenticated";

grant TRUNCATE on table public."profiles" to "authenticated";

grant UPDATE on table public."profiles" to "authenticated";

grant DELETE on table public."profiles" to "service_role";

grant INSERT on table public."profiles" to "service_role";

grant REFERENCES on table public."profiles" to "service_role";

grant SELECT on table public."profiles" to "service_role";

grant TRIGGER on table public."profiles" to "service_role";

grant TRUNCATE on table public."profiles" to "service_role";

grant UPDATE on table public."profiles" to "service_role";

grant SELECT on table public."purchase_receipts" to "authenticated";

grant DELETE on table public."purchase_receipts" to "service_role";

grant INSERT on table public."purchase_receipts" to "service_role";

grant REFERENCES on table public."purchase_receipts" to "service_role";

grant SELECT on table public."purchase_receipts" to "service_role";

grant TRIGGER on table public."purchase_receipts" to "service_role";

grant TRUNCATE on table public."purchase_receipts" to "service_role";

grant UPDATE on table public."purchase_receipts" to "service_role";

grant DELETE on table public."weekly_invoice_publications" to "anon";

grant INSERT on table public."weekly_invoice_publications" to "anon";

grant REFERENCES on table public."weekly_invoice_publications" to "anon";

grant SELECT on table public."weekly_invoice_publications" to "anon";

grant TRIGGER on table public."weekly_invoice_publications" to "anon";

grant TRUNCATE on table public."weekly_invoice_publications" to "anon";

grant UPDATE on table public."weekly_invoice_publications" to "anon";

grant DELETE on table public."weekly_invoice_publications" to "authenticated";

grant INSERT on table public."weekly_invoice_publications" to "authenticated";

grant REFERENCES on table public."weekly_invoice_publications" to "authenticated";

grant SELECT on table public."weekly_invoice_publications" to "authenticated";

grant TRIGGER on table public."weekly_invoice_publications" to "authenticated";

grant TRUNCATE on table public."weekly_invoice_publications" to "authenticated";

grant UPDATE on table public."weekly_invoice_publications" to "authenticated";

grant DELETE on table public."weekly_invoice_publications" to "service_role";

grant INSERT on table public."weekly_invoice_publications" to "service_role";

grant REFERENCES on table public."weekly_invoice_publications" to "service_role";

grant SELECT on table public."weekly_invoice_publications" to "service_role";

grant TRIGGER on table public."weekly_invoice_publications" to "service_role";

grant TRUNCATE on table public."weekly_invoice_publications" to "service_role";

grant UPDATE on table public."weekly_invoice_publications" to "service_role";

grant DELETE on table public."weekly_invoices" to "anon";

grant INSERT on table public."weekly_invoices" to "anon";

grant REFERENCES on table public."weekly_invoices" to "anon";

grant SELECT on table public."weekly_invoices" to "anon";

grant TRIGGER on table public."weekly_invoices" to "anon";

grant TRUNCATE on table public."weekly_invoices" to "anon";

grant UPDATE on table public."weekly_invoices" to "anon";

grant DELETE on table public."weekly_invoices" to "authenticated";

grant INSERT on table public."weekly_invoices" to "authenticated";

grant REFERENCES on table public."weekly_invoices" to "authenticated";

grant SELECT on table public."weekly_invoices" to "authenticated";

grant TRIGGER on table public."weekly_invoices" to "authenticated";

grant TRUNCATE on table public."weekly_invoices" to "authenticated";

grant UPDATE on table public."weekly_invoices" to "authenticated";

grant DELETE on table public."weekly_invoices" to "service_role";

grant INSERT on table public."weekly_invoices" to "service_role";

grant REFERENCES on table public."weekly_invoices" to "service_role";

grant SELECT on table public."weekly_invoices" to "service_role";

grant TRIGGER on table public."weekly_invoices" to "service_role";

grant TRUNCATE on table public."weekly_invoices" to "service_role";

grant UPDATE on table public."weekly_invoices" to "service_role";

-- REVIEW sequence grants, extensions and schema privileges separately before applying.

notify pgrst, 'reload schema';

commit;
