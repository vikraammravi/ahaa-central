begin;
create or replace function public.catalog_page(p_page integer default 0,p_search text default '',p_category text default '',p_status text default 'all',p_stock_status text default 'ALL',p_stock_overrides jsonb default '{}')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role::text='CENTRAL_ADMIN' and status::text='active') then raise exception 'An active central admin is required.';end if;
 if p_page is null or p_page<0 or p_status not in('all','active','inactive') or p_stock_status not in('ALL','in-stock','low-stock','out-of-stock') or jsonb_typeof(p_stock_overrides) is distinct from 'object' then raise exception 'Choose valid catalog filters.';end if;
 with products as materialized(
  select c.*,case lower(trim(c.category)) when 'sweet' then 'Desserts' when 'pantry' then 'Grocery' else c.category end as normalized_category,
   case when coalesce(p_stock_overrides->>c.id::text,'') ~ '^\d{1,10}$' then (p_stock_overrides->>c.id::text)::bigint else c.available_stock end as displayed_stock
  from public.catalog_items c
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
create index if not exists catalog_active_name_page on public.catalog_items(is_active,name,id);
notify pgrst,'reload schema';
commit;
