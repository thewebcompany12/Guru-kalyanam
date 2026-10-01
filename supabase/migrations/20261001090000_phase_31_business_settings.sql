-- Phase 31: reusable per-user business profile for invoices
create table if not exists public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Guru Kalyanam',
  gstin text,
  address text,
  state text not null default 'Uttar Pradesh',
  state_code text not null default '09',
  phone text,
  email text,
  invoice_prefix text not null default 'INV',
  updated_at timestamptz not null default now()
);
alter table public.business_settings enable row level security;
drop policy if exists "Users manage own business settings" on public.business_settings;
create policy "Users manage own business settings" on public.business_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.business_settings to authenticated;
