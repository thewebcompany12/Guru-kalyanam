-- Phase 28: GST invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  seller_name text not null,
  seller_gstin text,
  seller_address text,
  seller_state text,
  seller_state_code text,
  buyer_name text not null,
  buyer_gstin text,
  buyer_address text,
  buyer_state text,
  buyer_state_code text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  taxable_amount numeric not null default 0,
  cgst_amount numeric not null default 0,
  sgst_amount numeric not null default 0,
  igst_amount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'ISSUED' check (status in ('DRAFT','ISSUED','CANCELLED')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric not null,
  unit text not null,
  unit_price numeric not null,
  discount numeric not null default 0,
  taxable_amount numeric not null default 0,
  tax_rate numeric not null default 0,
  cgst_amount numeric not null default 0,
  sgst_amount numeric not null default 0,
  igst_amount numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_school_id on public.invoices(school_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
drop policy if exists "authenticated invoice read" on public.invoices;
drop policy if exists "authenticated invoice write" on public.invoices;
drop policy if exists "authenticated invoice item read" on public.invoice_items;
drop policy if exists "authenticated invoice item write" on public.invoice_items;
create policy "authenticated invoice read" on public.invoices for select using ((select auth.uid()) is not null);
create policy "authenticated invoice write" on public.invoices for all using ((select private.has_write_access())) with check ((select private.has_write_access()));
create policy "authenticated invoice item read" on public.invoice_items for select using ((select auth.uid()) is not null);
create policy "authenticated invoice item write" on public.invoice_items for all using ((select private.has_write_access())) with check ((select private.has_write_access()));
