begin;
-- Staging initially used a stricter guard. Preserve that database's function
-- ownership while allowing corrections to any invoice that has not been sent.
do $$
declare definition text; updated text;
begin
  select pg_get_functiondef('public.edit_invoice(uuid,jsonb,text,timestamptz)'::regprocedure) into definition;
  if position('Sent combined invoices cannot be edited.' in definition) > 0 then return; end if;
  updated := replace(definition,
    '(sent_at is not null or payment_status = ''PAID'')',
    'sent_at is not null');
  updated := replace(updated, 'Sent or paid combined invoices cannot be edited.', 'Sent combined invoices cannot be edited.');
  if updated = definition or position('Sent combined invoices cannot be edited.' in updated) = 0 then
    raise exception 'Unexpected invoice editor; migration stopped.';
  end if;
  execute updated;
end; $$;
notify pgrst, 'reload schema';
commit;
