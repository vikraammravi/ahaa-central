begin;
create function public.admin_branch_stock(p_page integer default 0,p_search text default '',p_category text default '',p_branch_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
end;$$;
revoke all on function public.admin_branch_stock(integer,text,text,uuid) from public,anon;
grant execute on function public.admin_branch_stock(integer,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
