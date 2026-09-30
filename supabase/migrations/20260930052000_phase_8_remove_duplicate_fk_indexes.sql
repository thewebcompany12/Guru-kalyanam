-- Phase 8: remove FK indexes that duplicate existing covering indexes
drop index if exists public.ix_deliveries_order_id_fk;
drop index if exists public.ix_deliveries_school_id_fk;
drop index if exists public.ix_inventory_product_id_fk;
drop index if exists public.ix_order_items_order_id_fk;
drop index if exists public.ix_order_items_product_id_fk;
drop index if exists public.ix_order_template_items_product_id_fk;
drop index if exists public.ix_payments_order_id_fk;
drop index if exists public.ix_products_category_id_fk;
drop index if exists public.ix_purchase_items_purchase_id_fk;
drop index if exists public.ix_school_contacts_school_id_fk;
