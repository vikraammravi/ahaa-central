begin;
alter table public.weekly_invoices add column payment_status text not null default 'UNPAID' check(payment_status in ('UNPAID','PAID')),
 add column payment_updated_at timestamptz, add column payment_updated_by uuid references public.profiles(id),
 add column payment_updated_name text, add column payment_revision integer;
create function public.guard_invoice_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.payment_status<>'UNPAID' or new.payment_updated_at is not null or new.payment_updated_by is not null or new.payment_updated_name is not null or new.payment_revision is not null then raise exception 'Use the admin payment action.';end if;
  elsif new.payment_status is distinct from old.payment_status or new.payment_updated_at is distinct from old.payment_updated_at or new.payment_updated_by is distinct from old.payment_updated_by or new.payment_updated_name is distinct from old.payment_updated_name or new.payment_revision is distinct from old.payment_revision then raise exception 'Use the admin payment action.';end if;
 end if;
 return new;
end;$$;
create trigger weekly_invoice_guard_payment before insert or update on public.weekly_invoices for each row execute function public.guard_invoice_payment();
create function public.set_invoice_payment_status(p_invoice_id uuid,p_status text,p_expected_updated_at timestamptz default null) returns timestamptz language plpgsql security definer set search_path='' as $$
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
end;$$;
revoke all on function public.set_invoice_payment_status(uuid,text,timestamptz) from public,anon;
grant execute on function public.set_invoice_payment_status(uuid,text,timestamptz) to authenticated;
commit;
