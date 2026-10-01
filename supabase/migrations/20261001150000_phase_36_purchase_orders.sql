-- Phase 36: purchase orders, partial receipts, and atomic inventory updates.
alter table public.purchase_items
  add column if not exists received_quantity numeric(14,3) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_items_received_quantity_check') then
    alter table public.purchase_items add constraint purchase_items_received_quantity_check
      check (received_quantity >= 0 and received_quantity <= quantity);
  end if;
end $$;

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  idempotency_key uuid not null unique,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete cascade,
  purchase_item_id uuid not null references public.purchase_items(id),
  product_id uuid references public.products(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists purchase_receipts_purchase_created_idx on public.purchase_receipts(purchase_id, created_at desc);
create index if not exists purchase_receipt_items_receipt_idx on public.purchase_receipt_items(receipt_id);
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
grant select on public.purchase_receipts, public.purchase_receipt_items to authenticated;
drop policy if exists "purchase receipts read" on public.purchase_receipts;
create policy "purchase receipts read" on public.purchase_receipts for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "purchase receipt items read" on public.purchase_receipt_items;
create policy "purchase receipt items read" on public.purchase_receipt_items for select to authenticated using ((select auth.uid()) is not null);

create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_purchase_date date,
  p_expected_arrival_date date,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public, private
as $$
declare
  v_purchase_id uuid;
  v_total numeric(14,2) := 0;
  v_item record;
begin
  if auth.uid() is null or not private.has_write_access() then raise exception 'Write access required'; end if;
  if p_supplier_id is null then raise exception 'Select a supplier'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item'; end if;

  insert into public.purchases(supplier_id, purchase_date, expected_arrival_date, status, total, paid_amount, notes, created_by)
  values(p_supplier_id, coalesce(p_purchase_date, current_date), p_expected_arrival_date, 'ORDERED', 0, 0, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, product_name text, quantity numeric, unit text, unit_cost numeric)
  loop
    if coalesce(v_item.quantity, 0) <= 0 then raise exception 'Item quantity must be greater than zero'; end if;
    if coalesce(v_item.unit_cost, -1) < 0 then raise exception 'Unit cost cannot be negative'; end if;
    if nullif(trim(v_item.product_name), '') is null then raise exception 'Every item needs a name'; end if;
    if v_item.product_id is not null and not exists(select 1 from public.products where id = v_item.product_id) then raise exception 'Selected product no longer exists'; end if;

    insert into public.purchase_items(purchase_id, product_id, product_name, quantity, received_quantity, unit, unit_cost, line_total)
    values(v_purchase_id, v_item.product_id, trim(v_item.product_name), v_item.quantity, 0, coalesce(nullif(trim(v_item.unit), ''), 'piece'), v_item.unit_cost, round(v_item.quantity * v_item.unit_cost, 2));
    v_total := v_total + round(v_item.quantity * v_item.unit_cost, 2);
  end loop;

  update public.purchases set total = v_total, updated_at = now() where id = v_purchase_id;
  return v_purchase_id;
end;
$$;

create or replace function public.receive_purchase_order(
  p_purchase_id uuid,
  p_idempotency_key uuid,
  p_items jsonb,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public, private
as $$
declare
  v_receipt_id uuid;
  v_purchase_status text;
  v_item record;
  v_line public.purchase_items%rowtype;
  v_received_all boolean;
begin
  if auth.uid() is null or not private.has_write_access() then raise exception 'Write access required'; end if;
  if p_purchase_id is null or p_idempotency_key is null then raise exception 'Purchase and receipt key are required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Enter at least one received quantity'; end if;

  -- Repeated network submissions using the same key return the original receipt without stock changes.
  insert into public.purchase_receipts(purchase_id, idempotency_key, notes, created_by)
  values(p_purchase_id, p_idempotency_key, nullif(trim(p_notes), ''), auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    select id into v_receipt_id from public.purchase_receipts where idempotency_key = p_idempotency_key;
    if not exists(select 1 from public.purchase_receipts where id = v_receipt_id and purchase_id = p_purchase_id) then
      raise exception 'Receipt key was already used for another purchase';
    end if;
    return v_receipt_id;
  end if;

  select status into v_purchase_status from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_purchase_status = 'CANCELLED' then raise exception 'Cancelled purchase orders cannot be received'; end if;
  if v_purchase_status = 'DRAFT' then raise exception 'Order the purchase before receiving stock'; end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(purchase_item_id uuid, quantity numeric)
  loop
    if coalesce(v_item.quantity, 0) <= 0 then raise exception 'Received quantity must be greater than zero'; end if;
    select * into v_line from public.purchase_items where id = v_item.purchase_item_id and purchase_id = p_purchase_id for update;
    if not found then raise exception 'Purchase line not found'; end if;
    if v_line.received_quantity + v_item.quantity > v_line.quantity then
      raise exception 'Received quantity exceeds the remaining quantity for %', v_line.product_name;
    end if;

    update public.purchase_items set received_quantity = received_quantity + v_item.quantity where id = v_line.id;
    insert into public.purchase_receipt_items(receipt_id, purchase_item_id, product_id, quantity)
    values(v_receipt_id, v_line.id, v_line.product_id, v_item.quantity);

    if v_line.product_id is not null then
      insert into public.inventory_transactions(product_id, quantity, transaction_type, reference_type, reference_id, notes, created_by)
      values(v_line.product_id, v_item.quantity, 'PURCHASE', 'PURCHASE_RECEIPT', v_receipt_id, 'Received for purchase #' || p_purchase_id::text, auth.uid());
      insert into public.inventory(product_id, incoming_stock, reserved_stock, available_stock, updated_at)
      values(v_line.product_id, 0, 0, v_item.quantity, now())
      on conflict (product_id) do update
      set available_stock = public.inventory.available_stock + excluded.available_stock, updated_at = now();
      update public.products set current_stock = current_stock + v_item.quantity, purchase_price = v_line.unit_cost, updated_at = now()
      where id = v_line.product_id;
    end if;
  end loop;

  select not exists(select 1 from public.purchase_items where purchase_id = p_purchase_id and received_quantity < quantity)
    into v_received_all;
  update public.purchases set status = case when v_received_all then 'RECEIVED' else 'PARTIALLY_RECEIVED' end, updated_at = now()
  where id = p_purchase_id;
  return v_receipt_id;
end;
$$;

revoke execute on function public.create_purchase_order(uuid,date,date,text,jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid,date,date,text,jsonb) to authenticated;
revoke execute on function public.receive_purchase_order(uuid,uuid,jsonb,text) from public, anon;
grant execute on function public.receive_purchase_order(uuid,uuid,jsonb,text) to authenticated;
