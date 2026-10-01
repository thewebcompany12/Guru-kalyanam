-- Phase 37: supplier payment ledger. Apply only after reviewing this migration.
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_id uuid null references public.purchases(id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER')),
  reference_number text null,
  notes text null,
  is_advance boolean not null default false,
  idempotency_key uuid not null unique,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint supplier_payment_purchase_or_advance check (purchase_id is not null or is_advance)
);

alter table public.suppliers
  add column if not exists advance_balance numeric(14,2) not null default 0
  check (advance_balance >= 0);

create index if not exists supplier_payments_supplier_date_idx
  on public.supplier_payments (supplier_id, payment_date desc, created_at desc);
create index if not exists supplier_payments_purchase_idx
  on public.supplier_payments (purchase_id) where purchase_id is not null;

alter table public.supplier_payments enable row level security;
drop policy if exists "Authenticated users can read supplier payments" on public.supplier_payments;
create policy "Authenticated users can read supplier payments"
  on public.supplier_payments for select to authenticated
  using ((select auth.uid()) is not null);

revoke all on public.supplier_payments from anon, authenticated;
grant select on public.supplier_payments to authenticated;

-- Keep the existing supplier balance aligned with future purchase-order changes,
-- without rewriting historical balances during deployment.
create or replace function private.sync_supplier_outstanding_delta()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_old_due numeric(14,2) := 0;
  v_new_due numeric(14,2) := 0;
begin
  if tg_op <> 'INSERT' then
    v_old_due := case when old.status = 'CANCELLED' then 0 else greatest(0, old.total - old.paid_amount) end;
    update public.suppliers
      set outstanding_amount = greatest(0, outstanding_amount - v_old_due),
          updated_at = now()
      where id = old.supplier_id;
  end if;

  if tg_op <> 'DELETE' then
    v_new_due := case when new.status = 'CANCELLED' then 0 else greatest(0, new.total - new.paid_amount) end;
    update public.suppliers
      set outstanding_amount = outstanding_amount + v_new_due,
          updated_at = now()
      where id = new.supplier_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function private.sync_supplier_outstanding_delta() from public, anon, authenticated;

drop trigger if exists sync_supplier_outstanding_delta on public.purchases;
create trigger sync_supplier_outstanding_delta
  after insert or update or delete
  on public.purchases
  for each row execute function private.sync_supplier_outstanding_delta();

create or replace function public.record_supplier_payment(
  p_supplier_id uuid,
  p_purchase_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text,
  p_notes text,
  p_is_advance boolean,
  p_idempotency_key uuid
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_payment_id uuid;
  v_existing_supplier_id uuid;
  v_existing_purchase_id uuid;
  v_existing_amount numeric(14,2);
  v_purchase_supplier_id uuid;
  v_purchase_status text;
  v_due numeric(14,2);
  v_applied numeric(14,2) := 0;
  v_advance numeric(14,2) := 0;
begin
  if auth.uid() is null or not private.has_write_access() then
    raise exception 'Write access required';
  end if;
  if p_supplier_id is null or p_idempotency_key is null then
    raise exception 'Supplier and idempotency key are required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_payment_mode is null or p_payment_mode not in ('CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER') then
    raise exception 'Select a valid payment mode';
  end if;
  if p_purchase_id is null and coalesce(p_is_advance, false) is false then
    raise exception 'Select a purchase order or mark this as an advance payment';
  end if;

  select id, supplier_id, purchase_id, amount
    into v_payment_id, v_existing_supplier_id, v_existing_purchase_id, v_existing_amount
    from public.supplier_payments where idempotency_key = p_idempotency_key;
  if v_payment_id is not null then
    if v_existing_supplier_id <> p_supplier_id
      or v_existing_purchase_id is distinct from p_purchase_id
      or v_existing_amount <> p_amount then
      raise exception 'Idempotency key was already used for a different payment';
    end if;
    return v_payment_id;
  end if;

  perform 1 from public.suppliers where id = p_supplier_id for update;
  if not found then raise exception 'Supplier not found'; end if;

  -- Recheck after the supplier lock so simultaneous retries with the same key
  -- return the first committed payment instead of surfacing a unique-key error.
  select id, supplier_id, purchase_id, amount
    into v_payment_id, v_existing_supplier_id, v_existing_purchase_id, v_existing_amount
    from public.supplier_payments where idempotency_key = p_idempotency_key;
  if v_payment_id is not null then
    if v_existing_supplier_id <> p_supplier_id
      or v_existing_purchase_id is distinct from p_purchase_id
      or v_existing_amount <> p_amount then
      raise exception 'Idempotency key was already used for a different payment';
    end if;
    return v_payment_id;
  end if;

  if p_purchase_id is not null then
    select supplier_id, greatest(0, total - paid_amount), status
      into v_purchase_supplier_id, v_due, v_purchase_status
      from public.purchases where id = p_purchase_id for update;
    if not found then raise exception 'Purchase order not found'; end if;
    if v_purchase_supplier_id <> p_supplier_id then
      raise exception 'Purchase order does not belong to the selected supplier';
    end if;
    if v_purchase_status = 'CANCELLED' then
      raise exception 'Cancelled purchase orders cannot receive payments';
    end if;
    if coalesce(p_is_advance, false) is false and p_amount > v_due then
      raise exception 'Payment exceeds the purchase order balance. Mark it as an advance only if the excess is intentional.';
    end if;
    v_applied := least(p_amount, v_due);
    v_advance := p_amount - v_applied;
  else
    v_advance := p_amount;
  end if;

  insert into public.supplier_payments (
    supplier_id, purchase_id, payment_date, amount, payment_mode,
    reference_number, notes, is_advance, idempotency_key, created_by
  ) values (
    p_supplier_id, p_purchase_id, coalesce(p_payment_date, current_date), p_amount,
    p_payment_mode, nullif(trim(p_reference_number), ''), nullif(trim(p_notes), ''),
    (coalesce(p_is_advance, false) and (p_purchase_id is null or v_advance > 0)),
    p_idempotency_key, auth.uid()
  ) returning id into v_payment_id;

  if p_purchase_id is not null and v_applied > 0 then
    -- The purchase trigger updates supplier outstanding by the applied amount.
    update public.purchases
      set paid_amount = paid_amount + v_applied, updated_at = now()
      where id = p_purchase_id;
  end if;

  if v_advance > 0 then
    update public.suppliers
      set advance_balance = advance_balance + v_advance, updated_at = now()
      where id = p_supplier_id;
  end if;

  return v_payment_id;
end;
$function$;

revoke all on function public.record_supplier_payment(uuid, uuid, date, numeric, text, text, text, boolean, uuid) from public, anon;
grant execute on function public.record_supplier_payment(uuid, uuid, date, numeric, text, text, text, boolean, uuid) to authenticated;
