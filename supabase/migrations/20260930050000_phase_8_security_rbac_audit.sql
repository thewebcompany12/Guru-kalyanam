-- Phase 8: security, RBAC, audit logging and function hardening
create schema if not exists private;

create or replace function private.has_write_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('OWNER'::public.user_role, 'ADMIN'::public.user_role, 'SALES_PERSON'::public.user_role, 'DELIVERY_PERSON'::public.user_role)
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_role public.user_role;
begin
  perform pg_catalog.pg_advisory_xact_lock(873421);
  if not exists (select 1 from public.profiles) then v_role := 'OWNER'::public.user_role;
  else v_role := 'VIEWER'::public.user_role; end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_old jsonb; v_new jsonb; v_entity_id uuid;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  insert into public.activity_logs(actor_id, entity_type, entity_id, action, old_data, new_data)
  values ((select auth.uid()), tg_table_name, v_entity_id, tg_op, v_old, v_new);
  return coalesce(new, old);
end;
$$;

revoke execute on function private.has_write_access() from public, anon;
grant execute on function private.has_write_access() to authenticated;
revoke execute on function private.audit_row_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_authenticated() from public, anon;
grant execute on function public.is_authenticated() to authenticated;
revoke execute on function public.recalculate_inventory(uuid) from public, anon;
grant execute on function public.recalculate_inventory(uuid) to authenticated;
revoke execute on function public.recalculate_order_totals(uuid) from public, anon;
grant execute on function public.recalculate_order_totals(uuid) to authenticated;
revoke execute on function public.create_order(uuid,uuid,date,date,text,jsonb) from public, anon;
grant execute on function public.create_order(uuid,uuid,date,date,text,jsonb) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['schools','school_contacts','locations','school_visits','product_categories','products','suppliers','order_templates','order_template_items','orders','order_items','deliveries','inventory_transactions','inventory','purchases','purchase_items','payments','reminders','tasks','attachments'] loop
    execute format('drop policy if exists "authenticated access" on public.%I', t);
    execute format('drop policy if exists "authenticated read" on public.%I', t);
    execute format('drop policy if exists "authenticated write" on public.%I', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create policy "authenticated read" on public.%I for select to authenticated using ((select auth.uid()) is not null)', t);
    execute format('create policy "authenticated write" on public.%I for all to authenticated using ((select private.has_write_access())) with check ((select private.has_write_access()))', t);
  end loop;
end $$;

drop policy if exists "authenticated access" on public.profiles;
drop policy if exists "authenticated read" on public.profiles;
drop policy if exists "profile self read" on public.profiles;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
create policy "profile self read" on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "authenticated access" on public.notifications;
drop policy if exists "notification self read" on public.notifications;
drop policy if exists "notification self update" on public.notifications;
revoke all on table public.notifications from anon, authenticated;
grant select, update on table public.notifications to authenticated;
create policy "notification self read" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification self update" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated access" on public.activity_logs;
drop policy if exists "activity read" on public.activity_logs;
revoke all on table public.activity_logs from anon, authenticated;
grant select on table public.activity_logs to authenticated;
create policy "activity read" on public.activity_logs for select to authenticated using ((select auth.uid()) is not null);

do $$
declare t text;
begin
  foreach t in array array['schools','school_contacts','locations','school_visits','product_categories','products','suppliers','order_templates','order_template_items','orders','order_items','deliveries','inventory_transactions','inventory','purchases','purchase_items','payments','reminders','tasks','attachments'] loop
    execute format('drop trigger if exists audit_row_change on public.%I', t);
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.audit_row_change()', t);
  end loop;
end $$;

alter table public.profiles alter column role set default 'VIEWER'::public.user_role;
