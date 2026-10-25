begin;
do $$
declare actor uuid; category_id uuid; unit_id uuid; product uuid; suffix text:=substr(gen_random_uuid()::text,1,8); category_name text; unit_name text; denied boolean;
begin
 select id into actor from public.profiles where role::text='CENTRAL_ADMIN' and status::text='active' limit 1;
 if actor is null then raise exception 'An active admin is required for this test.';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 set local role authenticated;
 category_name:='Test Category '||suffix;unit_name:='Test Unit '||suffix;
 insert into public.catalog_categories(name) values(category_name) returning id into category_id;
 insert into public.catalog_units(name) values(unit_name) returning id into unit_id;
 denied:=false;
 begin insert into public.catalog_units(name) values(lower(unit_name));exception when unique_violation then denied:=true;end;
 if not denied then raise exception 'Case-insensitive duplicates were accepted';end if;
 insert into public.catalog_items(name,category,unit_type,default_price) values('Test Product '||suffix,category_name,unit_name,1) returning id into product;
 if not (select ever_used from public.catalog_units where id=unit_id) then raise exception 'Usage not tracked';end if;
 update public.catalog_units set name=unit_name||' renamed' where id=unit_id;
 if (select unit_type from public.catalog_items where id=product)<>unit_name||' renamed' then raise exception 'Rename did not propagate';end if;
 update public.catalog_categories set is_active=false where id=category_id;
 -- Existing products can still be edited without changing their inactive option.
 update public.catalog_items set default_price=2 where id=product;
 denied:=false;
 begin insert into public.catalog_items(name,category,unit_type,default_price) values('Blocked Product',category_name,unit_name||' renamed',1);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Inactive option accepted for a new item';end if;
 denied:=false;
 begin delete from public.catalog_units where id=unit_id;exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Used unit deletion was accepted';end if;
 insert into public.catalog_units(name) values('Unused '||suffix);
 delete from public.catalog_units where name='Unused '||suffix;
 denied:=false;
 begin update public.catalog_units set ever_used=false where id=unit_id;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Usage protection could be overridden';end if;
 reset role;
end;$$;
rollback;
select 'Catalog options passed: custom units, duplicates, rename, inactive selection and history protections; test records rolled back' as result;
