create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type,entity_id);
create index if not exists orders_status_date_idx on public.orders(status,order_date desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);