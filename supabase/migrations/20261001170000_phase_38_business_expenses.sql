-- Phase 38: operating expense ledger, separate from collections and supplier payments.
create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in ('TRAVEL','FUEL','FOOD','OFFICE_SUPPLIES','PHONE_INTERNET','BANK_CHARGES','REPAIRS','SALARIES','RENT','OTHER')),
  description text not null check (length(trim(description)) between 2 and 240),
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999999),
  payment_mode text not null check (payment_mode in ('CASH','UPI','BANK_TRANSFER','CHEQUE','OTHER')),
  reference_number text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_expenses_date_idx on public.business_expenses (expense_date desc, created_at desc);
create index if not exists business_expenses_category_date_idx on public.business_expenses (category, expense_date desc);

alter table public.business_expenses enable row level security;
revoke all on public.business_expenses from anon, authenticated;
grant select, insert, update, delete on public.business_expenses to authenticated;

drop policy if exists "Authenticated users can read business expenses" on public.business_expenses;
create policy "Authenticated users can read business expenses"
  on public.business_expenses for select to authenticated
  using (
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "Authorized users can insert business expenses" on public.business_expenses;
create policy "Authorized users can insert business expenses"
  on public.business_expenses for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.has_write_access()
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists "Authorized users can update business expenses" on public.business_expenses;
create policy "Authorized users can update business expenses"
  on public.business_expenses for update to authenticated
  using (
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.has_write_access()
  )
  with check (
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.has_write_access()
  );

drop policy if exists "Authorized users can delete business expenses" on public.business_expenses;
create policy "Authorized users can delete business expenses"
  on public.business_expenses for delete to authenticated
  using (
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.has_write_access()
  );

create or replace function private.touch_business_expense_updated_at()
returns trigger language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
revoke all on function private.touch_business_expense_updated_at() from public, anon, authenticated;
drop trigger if exists touch_business_expense_updated_at on public.business_expenses;
create trigger touch_business_expense_updated_at
  before update on public.business_expenses
  for each row execute function private.touch_business_expense_updated_at();
