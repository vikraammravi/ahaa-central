-- All fixtures and deletions are rolled back; no real account is removed.
begin;
do $$
declare actor uuid:=gen_random_uuid(); branch uuid; invoice uuid; count_id uuid;
begin
  select id into branch from public.locations where not is_central limit 1;
  if branch is null then raise exception 'A branch is required for this test.'; end if;
  insert into auth.users(id,email,raw_user_meta_data) values(actor,'deletion-test@example.invalid','{"full_name":"Deletion Test"}');
  insert into public.weekly_invoices(location_id,start_date,end_date,created_by)
    values(branch,current_date,current_date,actor) returning id into invoice;
  insert into public.weekly_invoice_publications(weekly_invoice_id,revision,published_by,snapshot)
    values(invoice,0,actor,'{"orders":[],"total":0}');
  insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name)
    values(branch,current_date,actor,'Deletion Test') returning id into count_id;
  delete from auth.users where id=actor;
  if exists(select 1 from public.profiles where id=actor) then raise exception 'Profile was not removed.'; end if;
  if not exists(select 1 from public.weekly_invoices where id=invoice and created_by is null) then raise exception 'Invoice was not preserved.'; end if;
  if not exists(select 1 from public.weekly_invoice_publications where weekly_invoice_id=invoice and published_by is null) then raise exception 'Publication was not preserved.'; end if;
  if not exists(select 1 from public.branch_inventory_counts where id=count_id and submitted_by is null and submitted_name='Deletion Test') then raise exception 'Inventory history was not preserved.'; end if;
end $$;
select 'Account removal preserves invoices and inventory history' as result;
rollback;
