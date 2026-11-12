begin;

grant create on schema public to ahaa_operations;

-- Keep the installed workspace-scoped editor and its existing audit trail.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef('public.edit_invoice(uuid,jsonb,text,timestamptz)'::regprocedure) into definition;
  updated := replace(definition,
    'if target.weekly_invoice_id is not null then perform 1 from public.weekly_invoices where id=target.weekly_invoice_id for update; end if;',
    'if target.weekly_invoice_id is not null then perform 1 from public.weekly_invoices where id=target.weekly_invoice_id for update; if not found or exists(select 1 from public.weekly_invoices where id=target.weekly_invoice_id and sent_at is not null) then raise exception ''Sent combined invoices cannot be edited.''; end if; end if;');
  if updated = definition then raise exception 'Unexpected invoice editor; migration stopped.'; end if;
  execute updated;
end; $$;

create function public.undo_combined_invoice(p_invoice_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare invoice public.weekly_invoices%rowtype;
begin
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Only an active admin can undo a combined invoice.'; end if;
  -- Match the order-then-invoice lock order used by sending and editing.
  perform 1 from public.orders where weekly_invoice_id=p_invoice_id order by id for update;
  select * into invoice from public.weekly_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Combined invoice not found.'; end if;
  if invoice.sent_at is not null or invoice.payment_status = 'PAID' or exists(select 1 from public.weekly_invoice_publications where weekly_invoice_id=invoice.id) then
    raise exception 'Sent or paid combined invoices cannot be undone.';
  end if;
  update public.orders set weekly_invoice_id=null,updated_at=clock_timestamp() where weekly_invoice_id=invoice.id;
  delete from public.weekly_invoices where id=invoice.id;
end; $$;
alter function public.undo_combined_invoice(uuid) owner to ahaa_operations;
revoke all on function public.undo_combined_invoice(uuid) from public,anon;
grant execute on function public.undo_combined_invoice(uuid) to authenticated;
revoke create on schema public from ahaa_operations;
notify pgrst, 'reload schema';
commit;
