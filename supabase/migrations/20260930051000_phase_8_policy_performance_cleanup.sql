-- Phase 8: make RLS policies operation-specific and index single-column foreign keys
do $$
declare t text;
begin
  foreach t in array array['schools','school_contacts','locations','school_visits','product_categories','products','suppliers','order_templates','order_template_items','orders','order_items','deliveries','inventory_transactions','inventory','purchases','purchase_items','payments','reminders','tasks','attachments'] loop
    execute format('drop policy if exists "authenticated write" on public.%I', t);
    execute format('drop policy if exists "authenticated insert" on public.%I', t);
    execute format('drop policy if exists "authenticated update" on public.%I', t);
    execute format('drop policy if exists "authenticated delete" on public.%I', t);
    execute format('create policy "authenticated insert" on public.%I for insert to authenticated with check ((select private.has_write_access()))', t);
    execute format('create policy "authenticated update" on public.%I for update to authenticated using ((select private.has_write_access())) with check ((select private.has_write_access()))', t);
    execute format('create policy "authenticated delete" on public.%I for delete to authenticated using ((select private.has_write_access()))', t);
  end loop;
end $$;

drop index if exists public.inventory_transactions_product_idx;
drop index if exists public.payments_school_idx;
drop index if exists public.school_visits_visited_by_idx;

do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as table_name, c.conname, a.attname as column_name
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.connamespace='public'::regnamespace and array_length(c.conkey,1)=1
  loop
    execute format('create index if not exists %I on public.%I (%I)', 'ix_' || r.table_name || '_' || r.column_name || '_fk', r.table_name, r.column_name);
  end loop;
end $$;
