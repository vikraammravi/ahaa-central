begin;
-- Employees have their own inventory scope, never the manager's order scope.
create or replace function public.current_location() returns uuid language sql stable security definer set search_path='' as $$
 select location_id from public.profiles where id=auth.uid() and status::text='active' and role::text in ('CENTRAL_ADMIN','BRANCH_MANAGER');
$$;
create function public.inventory_location() returns uuid language sql stable security definer set search_path='' as $$
 select p.location_id from public.profiles p join public.locations l on l.id=p.location_id
 where p.id=auth.uid() and p.status::text='active' and p.role::text in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') and l.is_central is not true;
$$;
create function public.guard_profile_access() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and public."current_role"() is distinct from 'CENTRAL_ADMIN' then
  if tg_op='INSERT' then raise exception 'Only admin can create profiles.'; end if;
  if new.id is distinct from old.id or new.role is distinct from old.role or new.status is distinct from old.status or new.location_id is distinct from old.location_id or new.email is distinct from old.email then raise exception 'Only admin can change access or branch assignment.'; end if;
 end if;
 if new.role::text='BRANCH_EMPLOYEE' and new.status::text='active' and not exists(select 1 from public.locations where id=new.location_id and is_central is not true) then raise exception 'Assign an active employee to a branch.'; end if;
 return new;
end; $$;
create trigger profiles_guard_access before insert or update on public.profiles for each row execute function public.guard_profile_access();
alter policy "Allow catalog read" on public.catalog_items using(public."current_role"() in ('CENTRAL_ADMIN','BRANCH_MANAGER'));
alter policy "Allow read access to locations for authenticated users" on public.locations using(public."current_role"()='CENTRAL_ADMIN' or id=public.current_location() or id=public.inventory_location());

create table public.branch_inventory_counts (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id), count_date date not null,
 submitted_by uuid not null references public.profiles(id), submitted_name text not null,
 submitted_at timestamptz not null default clock_timestamp(), notes text not null default ''
);
create index branch_inventory_counts_latest on public.branch_inventory_counts(location_id,count_date desc,submitted_at desc,id);
create table public.branch_inventory_lines (
 id uuid primary key default gen_random_uuid(), count_id uuid not null references public.branch_inventory_counts(id),
 item_id uuid not null references public.catalog_items(id), item_name text not null, unit_type text not null,
 quantity integer not null check(quantity>=0), unique(count_id,item_id)
);
alter table public.branch_inventory_counts enable row level security;
alter table public.branch_inventory_lines enable row level security;
create policy inventory_counts_read on public.branch_inventory_counts for select to authenticated using(public."current_role"()='CENTRAL_ADMIN' or location_id=public.inventory_location());
create policy inventory_lines_read on public.branch_inventory_lines for select to authenticated using(exists(select 1 from public.branch_inventory_counts c where c.id=count_id));
revoke all on public.branch_inventory_counts,public.branch_inventory_lines from anon,authenticated;
grant select on public.branch_inventory_counts,public.branch_inventory_lines to authenticated;

create function public.submit_branch_inventory(p_count_date date,p_lines jsonb,p_notes text default '',p_expected_count_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare branch uuid; actor public.profiles%rowtype; latest uuid; result uuid; item public.catalog_items%rowtype; input jsonb; qty numeric; expected integer;
begin
 select * into actor from public.profiles where id=auth.uid();
 branch:=public.inventory_location();
 if actor.role::text is distinct from 'BRANCH_EMPLOYEE' or actor.status::text is distinct from 'active' or branch is null then raise exception 'Only an active branch employee can submit inventory.'; end if;
 if p_count_date is distinct from (clock_timestamp() at time zone 'America/Toronto')::date then raise exception 'Submit the closing inventory for today.'; end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Notes must be 2000 characters or fewer.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(branch::text||p_count_date::text,0));
 select id into latest from public.branch_inventory_counts where location_id=branch and count_date=p_count_date order by submitted_at desc,id desc limit 1;
 if latest is distinct from p_expected_count_id then raise exception 'Another employee submitted a count. Reload and review it before saving.'; end if;
 -- Share lock prevents products changing during validation and submission.
 lock table public.catalog_items in share mode;
 select count(*) into expected from public.catalog_items where is_active is true;
 if expected=0 or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)<>expected or (select count(distinct value->>'item_id') from jsonb_array_elements(p_lines))<>expected then raise exception 'Enter every active item once. Reload if the catalog changed.'; end if;
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,notes) values(branch,p_count_date,actor.id,actor.full_name,coalesce(trim(p_notes),'')) returning id into result;
 for item in select * from public.catalog_items where is_active is true order by id loop
  select value into input from jsonb_array_elements(p_lines) where value->>'item_id'=item.id::text;
  if input is null or jsonb_typeof(input->'quantity') is distinct from 'number' then raise exception 'Enter a quantity for every item.'; end if;
  qty:=(input->>'quantity')::numeric;
  if qty<0 or qty>2147483647 or qty<>trunc(qty) then raise exception 'Inventory quantities must be nonnegative whole units.'; end if;
  insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity) values(result,item.id,item.name,item.unit_type::text,qty::integer);
 end loop;
 return result;
end; $$;

create function public.branch_inventory_workspace(p_count_date date default (now() at time zone 'America/Toronto')::date,p_location_id uuid default null,p_history_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare branch uuid; latest public.branch_inventory_counts%rowtype; today_id uuid; items jsonb; history jsonb; history_total integer; today date:=(now() at time zone 'America/Toronto')::date;
begin
 if public."current_role"()='CENTRAL_ADMIN' then branch:=p_location_id;
 else branch:=public.inventory_location(); if p_location_id is not null and p_location_id is distinct from branch then raise exception 'Inventory not accessible.'; end if; end if;
 if branch is null or not exists(select 1 from public.locations where id=branch and is_central is not true) then raise exception 'Choose an assigned branch.'; end if;
 if p_count_date is null or p_count_date>today or p_history_page is null or p_history_page<0 then raise exception 'Choose a valid inventory date and page.'; end if;
 select * into latest from public.branch_inventory_counts where location_id=branch and count_date<=p_count_date order by count_date desc,submitted_at desc,id desc limit 1;
 select id into today_id from public.branch_inventory_counts where location_id=branch and count_date=p_count_date order by submitted_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'unit_type',c.unit_type,'quantity',l.quantity) order by c.name,c.id),'[]') into items from public.catalog_items c left join public.branch_inventory_lines l on l.count_id=latest.id and l.item_id=c.id where c.is_active is true;
 select count(*) into history_total from public.branch_inventory_counts where location_id=branch and count_date<=p_count_date;
 select coalesce(jsonb_agg(to_jsonb(h)),'[]') into history from (select id,count_date,submitted_at,submitted_name,notes from public.branch_inventory_counts where location_id=branch and count_date<=p_count_date order by count_date desc,submitted_at desc,id desc limit 25 offset p_history_page*25) h;
 return jsonb_build_object('location_id',branch,'branch_name',(select name from public.locations where id=branch),'today',today,'count_date',p_count_date,'expected_count_id',today_id,'latest',case when latest.id is null then null else to_jsonb(latest) end,'items',items,'history',history,'history_total',history_total);
end; $$;
revoke all on function public.inventory_location(),public.submit_branch_inventory(date,jsonb,text,uuid),public.branch_inventory_workspace(date,uuid,integer) from public,anon;
grant execute on function public.inventory_location(),public.submit_branch_inventory(date,jsonb,text,uuid),public.branch_inventory_workspace(date,uuid,integer) to authenticated;
commit;
