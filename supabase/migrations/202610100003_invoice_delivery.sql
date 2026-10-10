begin;
alter table public.orders add column if not exists invoice_sent_at timestamptz;
alter table public.orders add column if not exists invoice_sent_by uuid references public.profiles(id);

create function public.guard_invoice_delivery() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.invoice_sent_at is not null or new.invoice_sent_by is not null then
        raise exception 'Invoice delivery is managed by the send invoice workflow.';
      end if;
    elsif new.invoice_sent_at is distinct from old.invoice_sent_at or new.invoice_sent_by is distinct from old.invoice_sent_by then
      raise exception 'Invoice delivery is managed by the send invoice workflow.';
    end if;
  end if;
  return new;
end;
$$;
create trigger orders_guard_invoice_delivery before insert or update on public.orders
for each row execute function public.guard_invoice_delivery();

create function public.send_invoice_to_branch(p_order_id uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype; target public.orders%rowtype; sent_at timestamptz;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role::text <> 'CENTRAL_ADMIN' or actor.status::text <> 'active' then
    raise exception 'Only an active central admin can send an invoice.';
  end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if target.status::text is distinct from 'COMPLETED' then raise exception 'Complete pickup before sending the final invoice.'; end if;
  if target.invoice_sent_at is not null then return target.invoice_sent_at; end if;
  sent_at := now();
  update public.orders set invoice_sent_at = sent_at, invoice_sent_by = actor.id, updated_at = now() where id = target.id;
  return sent_at;
end;
$$;
revoke all on function public.send_invoice_to_branch(uuid) from public, anon;
grant execute on function public.send_invoice_to_branch(uuid) to authenticated;
commit;
