create index if not exists payments_school_date_idx on public.payments(school_id,payment_date desc);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists reminders_due_completed_idx on public.reminders(completed,due_at);
create index if not exists tasks_due_completed_idx on public.tasks(completed,due_at);
create index if not exists notifications_user_read_idx on public.notifications(user_id,read_at,created_at desc);