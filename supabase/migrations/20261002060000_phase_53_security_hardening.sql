-- Phase 53: require an active, registered workspace member for shared business data.
-- New registrations start inactive and must be approved by an owner/admin.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_active boolean not null default false;

update public.profiles p
set email = u.email,
    is_active = (
      not coalesce(u.is_anonymous, false)
      and p.role in ('OWNER'::public.user_role, 'ADMIN'::public.user_role, 'SALES_PERSON'::public.user_role, 'DELIVERY_PERSON'::public.user_role)
    )
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role public.user_role;
  v_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(873421);
  if not coalesce(new.is_anonymous, false)
     and not exists (select 1 from public.profiles) then
    v_role := 'OWNER'::public.user_role;
    v_active := true;
  else
    v_role := 'VIEWER'::public.user_role;
    v_active := false;
  end if;

  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    v_role,
    v_active
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function private.has_workspace_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_active = true
    );
$function$;
revoke execute on function private.has_workspace_access() from public, anon;
grant execute on function private.has_workspace_access() to authenticated;

create or replace function private.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and is_active = true
        and role in ('OWNER'::public.user_role, 'ADMIN'::public.user_role)
    );
$function$;
revoke execute on function private.has_admin_access() from public, anon;
grant execute on function private.has_admin_access() to authenticated;

create or replace function private.has_owner_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and is_active = true
        and role = 'OWNER'::public.user_role
    );
$function$;
revoke execute on function private.has_owner_access() from public, anon;
grant execute on function private.has_owner_access() to authenticated;

create or replace function private.has_write_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and is_active = true
        and role in (
          'OWNER'::public.user_role,
          'ADMIN'::public.user_role,
          'SALES_PERSON'::public.user_role,
          'DELIVERY_PERSON'::public.user_role
        )
    );
$function$;

-- Replace broad SELECT policies that previously treated any non-null auth.uid()
-- as sufficient. Supabase anonymous users also have a UID and use the authenticated role.
do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual is not null
      and qual ~* 'auth[.]uid.*is not null'
      and qual !~* 'is_anonymous'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated using ((%s) and (select private.has_workspace_access()))',
      p.policyname, p.schemaname, p.tablename, p.qual
    );
  end loop;
end
$migration$;

-- Also secure unconditional SELECT policies (WhatsApp message content/templates).
do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual in ('true', '(true)')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated using ((select private.has_workspace_access()))',
      p.policyname, p.schemaname, p.tablename
    );
  end loop;
end
$migration$;

-- Policies that already excluded anonymous sessions still need to require active membership.
drop policy if exists "Authenticated users can read business expenses" on public.business_expenses;
create policy "Authenticated users can read business expenses"
  on public.business_expenses for select to authenticated
  using ((select private.has_workspace_access()));

drop policy if exists "Authenticated users can read supplier payments" on public.supplier_payments;
create policy "Authenticated users can read supplier payments"
  on public.supplier_payments for select to authenticated
  using ((select private.has_workspace_access()));

-- Visit-session write policies were accidentally created for PUBLIC.
do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'visit_sessions'
      and roles::text = '{public}'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.cmd = 'INSERT' then
      execute format(
        'create policy %I on %I.%I for insert to authenticated with check ((%s) and (select private.has_write_access()))',
        p.policyname, p.schemaname, p.tablename, p.with_check
      );
    elsif p.cmd = 'UPDATE' then
      execute format(
        'create policy %I on %I.%I for update to authenticated using ((%s) and (select private.has_write_access())) with check ((%s) and (select private.has_write_access()))',
        p.policyname, p.schemaname, p.tablename, p.qual, p.with_check
      );
    elsif p.cmd = 'DELETE' then
      execute format(
        'create policy %I on %I.%I for delete to authenticated using ((%s) and (select private.has_write_access()))',
        p.policyname, p.schemaname, p.tablename, p.qual
      );
    end if;
  end loop;
end
$migration$;

drop policy if exists "Users manage own business settings" on public.business_settings;
create policy "Users manage own business settings"
  on public.business_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_workspace_access()))
  with check ((select auth.uid()) = user_id and (select private.has_workspace_access()));

-- Admins may see team profiles and change only their role/active membership status.
grant select on public.profiles to authenticated;
grant update (role, is_active) on public.profiles to authenticated;
drop policy if exists "profile admin read" on public.profiles;
create policy "profile admin read"
  on public.profiles for select to authenticated
  using ((select private.has_admin_access()));
drop policy if exists "profile admin update" on public.profiles;
create policy "profile admin update"
  on public.profiles for update to authenticated
  using ((select private.has_admin_access()))
  with check (
    (select private.has_admin_access())
    and (role not in ('OWNER'::public.user_role, 'ADMIN'::public.user_role) or (select private.has_owner_access()))
  );

-- Sensitive SECURITY DEFINER RPCs remain atomic but reject anonymous/inactive users.
do $migration$
declare
  f record;
  updated_definition text;
begin
  for f in
    select p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_purchase_order', 'receive_purchase_order', 'record_supplier_payment')
      and p.prosecdef
  loop
    if position('is_anonymous' in f.definition) = 0 then
      updated_definition := regexp_replace(
        f.definition,
        $pattern$if auth[.]uid[(][)] is null[[:space:]]+or not private[.]has_write_access[(][)] then raise exception 'Write access required'; end if;$pattern$,
        $replacement$if auth.uid() is null or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) or not private.has_write_access() then raise exception 'Write access required'; end if;$replacement$,
        'gi'
      );
      if updated_definition = f.definition then
        raise exception 'Could not apply anonymous-session guard to function %', f.proname;
      end if;
      execute updated_definition;
    end if;
  end loop;
end
$migration$;
