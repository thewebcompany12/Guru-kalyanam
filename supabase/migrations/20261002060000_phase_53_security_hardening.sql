-- Phase 53: block anonymous sessions from shared business records and write RPCs.
-- The workspace has a registered owner account; guest sessions must not read shared records.

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
        and role in (
          'OWNER'::public.user_role,
          'ADMIN'::public.user_role,
          'SALES_PERSON'::public.user_role,
          'DELIVERY_PERSON'::public.user_role
        )
    );
$function$;

-- Restrict every broad SELECT policy that relied only on auth.uid() being non-null.
-- Supabase anonymous users also have a UID and use the authenticated database role.
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
      and qual ~* 'auth\.uid.*is not null'
      and qual !~* 'is_anonymous'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated using ((%s) and coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false)',
      p.policyname, p.schemaname, p.tablename, p.qual
    );
  end loop;
end
$migration$;

-- Invoice policies were accidentally granted to PUBLIC. Narrow them to registered
-- authenticated users and explicitly reject anonymous JWTs for write operations too.
do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('invoices', 'invoice_items')
      and cmd = 'ALL'
      and qual is not null
      and qual ilike '%has_write_access%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for all to authenticated using ((%s) and coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false) with check ((%s) and coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false)',
      p.policyname, p.schemaname, p.tablename, p.qual, coalesce(p.with_check, p.qual)
    );
  end loop;
end
$migration$;

-- Settings are per-account and should only be accessible to real signed-in accounts.
drop policy if exists "Users manage own business settings" on public.business_settings;
create policy "Users manage own business settings"
  on public.business_settings
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

-- SECURITY DEFINER RPCs remain necessary for atomic multi-table writes, but must
-- reject guest sessions in the function body as well as through RLS.
do $migration$
declare
  f record;
  updated_definition text;
begin
  for f in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_purchase_order', 'receive_purchase_order', 'record_supplier_payment')
      and p.prosecdef
  loop
    if position('is_anonymous' in f.definition) = 0 then
      updated_definition := regexp_replace(
        f.definition,
        $pattern$if auth\.uid\(\) is null[[:space:]]+or not private\.has_write_access\(\) then raise exception 'Write access required'; end if;$pattern$,
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
