create index if not exists inventory_product_idx on public.inventory(product_id);
create index if not exists inventory_transactions_product_created_idx on public.inventory_transactions(product_id, created_at desc);
create index if not exists purchases_supplier_date_idx on public.purchases(supplier_id, purchase_date desc);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index if not exists deliveries_status_date_idx on public.deliveries(status, scheduled_date);
create index if not exists deliveries_order_idx on public.deliveries(order_id);
create or replace function public.recalculate_inventory(p_product_id uuid)
returns void language plpgsql set search_path=public as $$
declare v numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select coalesce(sum(case when quantity > 0 then quantity else 0 end),0)-coalesce(sum(case when quantity < 0 then abs(quantity) else 0 end),0)
 into v from public.inventory_transactions where product_id=p_product_id;
 insert into public.inventory(product_id,incoming_stock,reserved_stock,available_stock,updated_at)
 values(p_product_id,0,0,greatest(v,0),now())
 on conflict (product_id) do update set available_stock=greatest(v,0),updated_at=now();
end; $$;
revoke execute on function public.recalculate_inventory(uuid) from public,anon;
grant execute on function public.recalculate_inventory(uuid) to authenticated;