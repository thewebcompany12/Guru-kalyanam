-- Phase 53 follow-up: normalize membership-based SELECT policies and remove PUBLIC invoice policies.
do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual is not null
      and qual ~* 'auth[.]uid.*is not null'
      and qual ilike '%has_workspace_access%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated using ((select private.has_workspace_access()))',
      p.policyname, p.schemaname, p.tablename
    );
  end loop;
end
$migration$;

do $migration$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('invoices', 'invoice_items')
      and cmd = 'ALL'
      and roles::text = '{public}'
      and coalesce(qual, '') ilike '%has_write_access%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for all to authenticated using ((select private.has_write_access())) with check ((select private.has_write_access()))',
      p.policyname, p.schemaname, p.tablename
    );
  end loop;
end
$migration$;
