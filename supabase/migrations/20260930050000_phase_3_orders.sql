-- Phase 3: order performance indexes and transactional order helpers.
create index if not exists order_template_items_template_idx on public.order_template_items(template_id, sort_order);
create index if not exists order_template_items_product_idx on public.order_template_items(product_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_product_idx on public.order_items(product_id);

create or replace function public.create_order(
  p_school_id uuid, p_contact_id uuid, p_order_date date,
  p_expected_delivery_date date, p_notes text, p_items jsonb
) returns uuid
language plpgsql set search_path=public
as $$
declare
  v_order_id uuid; v_subtotal numeric := 0; v_tax numeric := 0; v_item record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_school_id is null then raise exception 'School is required'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'At least one order item is required'; end if;
  insert into public.orders(school_id,contact_id,order_date,expected_delivery_date,status,payment_status,subtotal,discount,tax_amount,total,paid_amount,notes,created_by,updated_by)
  values(p_school_id,p_contact_id,coalesce(p_order_date,current_date),p_expected_delivery_date,'NEW','UNPAID',0,0,0,0,0,nullif(trim(p_notes),''),auth.uid(),auth.uid())
  returning id into v_order_id;
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid,product_name text,quantity numeric,unit text,unit_price numeric,discount numeric,tax_rate numeric,custom_item boolean)
  loop
    if coalesce(v_item.quantity,0)<=0 then raise exception 'Every item quantity must be greater than zero'; end if;
    if coalesce(v_item.unit_price,0)<0 then raise exception 'Item price cannot be negative'; end if;
    if coalesce(v_item.discount,0)<0 then raise exception 'Item discount cannot be negative'; end if;
    if coalesce(v_item.tax_rate,0)<0 then raise exception 'Item tax rate cannot be negative'; end if;
    if nullif(trim(v_item.product_name),'') is null then raise exception 'Every item needs a product name'; end if;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit,unit_price,discount,tax_rate,line_total,custom_item)
    values(v_order_id,v_item.product_id,trim(v_item.product_name),v_item.quantity,coalesce(nullif(trim(v_item.unit),''),'unit'),v_item.unit_price,coalesce(v_item.discount,0),coalesce(v_item.tax_rate,0),greatest(0,v_item.quantity*v_item.unit_price-coalesce(v_item.discount,0))*(1+coalesce(v_item.tax_rate,0)/100),coalesce(v_item.custom_item,false));
    v_subtotal := v_subtotal + greatest(0,v_item.quantity*v_item.unit_price-coalesce(v_item.discount,0));
    v_tax := v_tax + greatest(0,v_item.quantity*v_item.unit_price-coalesce(v_item.discount,0))*coalesce(v_item.tax_rate,0)/100;
  end loop;
  update public.orders set subtotal=v_subtotal,tax_amount=v_tax,total=v_subtotal+v_tax,updated_by=auth.uid(),updated_at=now() where id=v_order_id;
  return v_order_id;
end; $$;

revoke execute on function public.create_order(uuid,uuid,date,date,text,jsonb) from public,anon;
grant execute on function public.create_order(uuid,uuid,date,date,text,jsonb) to authenticated;

create or replace function public.recalculate_order_totals(p_order_id uuid)
returns void language plpgsql set search_path=public
as $$
declare v_subtotal numeric := 0; v_tax numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(sum(greatest(0,quantity*unit_price-discount)),0),coalesce(sum(greatest(0,quantity*unit_price-discount)*tax_rate/100),0)
  into v_subtotal,v_tax from public.order_items where order_id=p_order_id;
  update public.orders set subtotal=v_subtotal,tax_amount=v_tax,total=v_subtotal+v_tax-discount,updated_by=auth.uid(),updated_at=now() where id=p_order_id;
end; $$;

revoke execute on function public.recalculate_order_totals(uuid) from public,anon;
grant execute on function public.recalculate_order_totals(uuid) to authenticated;
