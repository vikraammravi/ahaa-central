begin;
create table public.catalog_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 is_active boolean not null default true, ever_used boolean not null default false,
 constraint catalog_category_name check(name=btrim(name) and length(name) between 1 and 60)
);
create unique index catalog_categories_name_ci on public.catalog_categories(lower(name));
create table public.catalog_units (like public.catalog_categories including all);
create unique index catalog_units_name_ci on public.catalog_units(lower(name));

insert into public.catalog_categories(name) select distinct case lower(trim(category)) when 'sweet' then 'Desserts' when 'pantry' then 'Grocery' else trim(category) end from public.catalog_items on conflict do nothing;
insert into public.catalog_categories(name) select unnest(array['Batter','Curry','Chutney','Desserts','Grocery','Diary','Podi','Packaging']) on conflict do nothing;
insert into public.catalog_units(name) select distinct unit_type::text from public.catalog_items on conflict do nothing;
insert into public.catalog_units(name) select unnest(array['Bucket','Tray','Piece','Can','Box','Bottle','Bag']) on conflict do nothing;
alter table public.catalog_items alter column unit_type type text using unit_type::text;
update public.catalog_items set category=case lower(trim(category)) when 'sweet' then 'Desserts' when 'pantry' then 'Grocery' else trim(category) end;
alter table public.catalog_items add constraint catalog_category_option_fk foreign key(category) references public.catalog_categories(name) on update cascade;
alter table public.catalog_items add constraint catalog_unit_option_fk foreign key(unit_type) references public.catalog_units(name) on update cascade;
update public.catalog_categories set ever_used=true where name in(select category from public.catalog_items);
update public.catalog_units set ever_used=true where name in(select unit_type from public.catalog_items);

create function public.guard_catalog_option_delete() returns trigger language plpgsql set search_path='' as $$
begin
 if old.ever_used then raise exception 'This option has been used. Deactivate it instead.';end if;
 return old;
end;$$;
create trigger guard_used_category before delete on public.catalog_categories for each row execute function public.guard_catalog_option_delete();
create trigger guard_used_unit before delete on public.catalog_units for each row execute function public.guard_catalog_option_delete();

create function public.validate_catalog_options() returns trigger language plpgsql security definer set search_path='' as $$
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
end;$$;
create trigger validate_catalog_options before insert or update of category,unit_type on public.catalog_items for each row execute function public.validate_catalog_options();

alter table public.catalog_categories enable row level security;
alter table public.catalog_units enable row level security;
create policy category_read on public.catalog_categories for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and status::text='active'));
create policy unit_read on public.catalog_units for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and status::text='active'));
create policy category_admin on public.catalog_categories for all to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active')) with check(exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active'));
create policy unit_admin on public.catalog_units for all to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active')) with check(exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active'));
revoke all on public.catalog_categories,public.catalog_units from anon,authenticated;
grant select,delete on public.catalog_categories,public.catalog_units to authenticated;
grant insert(name),update(name,is_active) on public.catalog_categories,public.catalog_units to authenticated;
create or replace function public.catalog_page(p_page integer default 0,p_search text default '',p_category text default '',p_status text default 'all',p_stock_status text default 'ALL',p_stock_overrides jsonb default '{}')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
  'rows',coalesce((select jsonb_agg(to_jsonb(r)-'normalized_category'-'displayed_stock' order by r.name,r.id) from(select * from filtered order by name,id limit 25 offset (select page*25 from paging)) r),'[]'),
  'count',paging.count,'page',paging.page,
  'categories',coalesce((select jsonb_agg(category order by category) from(select distinct normalized_category as category from products) categories),'[]')
 ) into result from paging;
 return result;
end; $$;
revoke all on function public.catalog_page(integer,text,text,text,text,jsonb) from public,anon;
grant execute on function public.catalog_page(integer,text,text,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
