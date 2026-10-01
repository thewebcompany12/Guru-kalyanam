create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'UTILITY',
  language text not null default 'en',
  body text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  contact_id uuid references public.school_contacts(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  recipient_name text,
  recipient_phone text not null,
  message_body text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','QUEUED','SENT','FAILED','CANCELLED')),
  provider_message_id text,
  error_message text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_messages enable row level security;
drop policy if exists "whatsapp_templates_select_authenticated" on public.whatsapp_templates;
create policy "whatsapp_templates_select_authenticated" on public.whatsapp_templates for select to authenticated using (true);
drop policy if exists "whatsapp_templates_write_workspace" on public.whatsapp_templates;
create policy "whatsapp_templates_write_workspace" on public.whatsapp_templates for all to authenticated using (private.has_write_access()) with check (private.has_write_access());
drop policy if exists "whatsapp_messages_select_authenticated" on public.whatsapp_messages;
create policy "whatsapp_messages_select_authenticated" on public.whatsapp_messages for select to authenticated using (true);
drop policy if exists "whatsapp_messages_write_workspace" on public.whatsapp_messages;
create policy "whatsapp_messages_write_workspace" on public.whatsapp_messages for all to authenticated using (private.has_write_access()) with check (private.has_write_access());
create index if not exists idx_whatsapp_messages_status_scheduled on public.whatsapp_messages(status, scheduled_at);
create index if not exists idx_whatsapp_messages_school on public.whatsapp_messages(school_id);
create index if not exists idx_whatsapp_messages_order on public.whatsapp_messages(order_id);
insert into public.whatsapp_templates(name,category,language,body)
values
('order_confirmation','UTILITY','en','Hello {{school}}, your order {{order_number}} has been confirmed. Thank you for choosing Guru Kalyanam.'),
('delivery_update','UTILITY','en','Hello {{school}}, your order {{order_number}} is scheduled for delivery. We will keep you updated.'),
('payment_received','UTILITY','en','Hello {{school}}, we received your payment of {{amount}} for order {{order_number}}. Thank you.'),
('follow_up','UTILITY','en','Hello {{school}}, this is a follow-up from Guru Kalyanam regarding your school supply requirements.')
on conflict (name) do nothing;
