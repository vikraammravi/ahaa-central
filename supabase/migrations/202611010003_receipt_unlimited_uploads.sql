begin;
alter table public.purchase_receipts drop constraint purchase_receipts_category_check;
update public.purchase_receipts set category='Miscellaneous' where category='Store Receipt';
alter table public.purchase_receipts add constraint purchase_receipts_category_check check(category in ('Supplier Invoice','Miscellaneous'));
create or replace function public.create_purchase_receipt(p_id uuid,p_user_id uuid,p_file_name text,p_file_path text,p_file_hash text,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare branch uuid; user_role text;
begin
 perform pg_advisory_xact_lock(730030003);
 select role::text,location_id into user_role,branch from public.profiles where id=p_user_id and status='active';
 if user_role is null or user_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER') or (user_role='BRANCH_MANAGER' and branch is null) then return false; end if;
 if user_role='CENTRAL_ADMIN' then branch:=null; end if;
 insert into public.purchase_receipts(id,created_by,location_id,file_name,file_path,file_hash,model,category)
 values(p_id,p_user_id,branch,p_file_name,p_file_path,p_file_hash,p_model,case when p_model='prebuilt-receipt' then 'Miscellaneous' else 'Supplier Invoice' end)
 on conflict do nothing;
 return found;
end;
$$;
commit;
