-- Requires the installed business-isolation/workspace-membership foundation.
-- Read-only history; does not modify stock, counts, or earlier submissions.
begin;

grant create on schema public to ahaa_operations;

create function public.branch_inventory_usage_history(
 p_from_date date default null,
 p_to_date date default null,
 p_search text default '',
 p_page integer default 0
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $$
declare
 business uuid := public.current_business_id();
 branch uuid := public.inventory_location();
 result jsonb;
begin
 if business is null or branch is null
 or public."current_role"() not in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') then
  raise exception 'An active branch manager or employee is required.';
 end if;
 if p_page is null or p_page < 0 or p_page > 1000000
 or length(coalesce(p_search,'')) > 200
 or (p_from_date is not null and p_to_date is not null and p_from_date > p_to_date) then
  raise exception 'Choose a valid date range, search and page.';
 end if;

 with latest as (
  select distinct on (c.count_date)
   c.id,c.count_date,c.submitted_name,c.submitted_at
  from public.branch_inventory_counts c
  where c.business_id=business and c.location_id=branch
   and (p_from_date is null or c.count_date>=p_from_date)
   and (p_to_date is null or c.count_date<=p_to_date)
  order by c.count_date desc,c.submitted_at desc,c.id desc
 ), filtered as (
  select l.id,l.item_id,l.item_name,l.unit_type,l.used_quantity,
   c.count_date,c.submitted_name,c.submitted_at
  from latest c join public.branch_inventory_lines l
   on l.count_id=c.id and l.business_id=business
  where strpos(lower(l.item_name),lower(trim(coalesce(p_search,''))))>0
 ), totals as (
  select count(*) as total from filtered
 ), pagination as (
  select total,least(p_page,greatest((total-1)/25,0))::integer as page from totals
 ), page_rows as (
  select * from filtered order by count_date desc,lower(item_name),item_id,id
  limit 25 offset (select page*25 from pagination)
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.count_date desc,lower(r.item_name),r.item_id,r.id) from page_rows r),'[]'::jsonb),
  'total',p.total,'page',p.page
 ) into result from pagination p;
 return result;
end; $$;

alter function public.branch_inventory_usage_history(date,date,text,integer) owner to ahaa_operations;
revoke all on function public.branch_inventory_usage_history(date,date,text,integer) from public,anon;
grant execute on function public.branch_inventory_usage_history(date,date,text,integer) to authenticated;

revoke create on schema public from ahaa_operations;

notify pgrst, 'reload schema';

commit;
