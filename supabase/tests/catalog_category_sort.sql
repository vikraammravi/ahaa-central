begin;
do $$
declare actor uuid; suffix text:=substr(gen_random_uuid()::text,1,8); first_page jsonb; second_page jsonb;
begin
 select id into actor from public.profiles where role::text='CENTRAL_ADMIN' and status::text='active' limit 1;
 if actor is null then raise exception 'An active admin is required.';end if;
 insert into public.catalog_categories(name) values('A sort '||suffix),('Z sort '||suffix);
 insert into public.catalog_units(name) values('Sort unit '||suffix);
 insert into public.catalog_items(name,category,unit_type,default_price)
 select 'Product '||lpad(i::text,2,'0')||' '||suffix,'A sort '||suffix,'Sort unit '||suffix,1 from generate_series(26,1,-1) i;
 insert into public.catalog_items(name,category,unit_type,default_price) values('Product 00 '||suffix,'Z sort '||suffix,'Sort unit '||suffix,1);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 set local role authenticated;
 first_page:=public.catalog_page(0,suffix,'','all','ALL','{}');
 second_page:=public.catalog_page(1,suffix,'','all','ALL','{}');
 if first_page->>'count'<>'27' or jsonb_array_length(first_page->'rows')<>25 or jsonb_array_length(second_page->'rows')<>2 then raise exception 'Incorrect page size or total';end if;
 if first_page->'rows'->0->>'name'<>'Product 01 '||suffix or first_page->'rows'->24->>'name'<>'Product 25 '||suffix then raise exception 'Items not ordered alphabetically within category';end if;
 if second_page->'rows'->0->>'name'<>'Product 26 '||suffix or second_page->'rows'->1->>'category'<>'Z sort '||suffix then raise exception 'Category ordering failed across pages';end if;
 reset role;
end;$$;
rollback;
select 'Catalog and Daily Stock category sorting passed, including cross-page ordering; temporary data rolled back' as result;
