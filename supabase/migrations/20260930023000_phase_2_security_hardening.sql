-- Phase 2 security hardening.
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path=public
as $$ begin new.updated_at=now(); return new; end $$;

create or replace function public.is_authenticated() returns boolean
language sql stable set search_path=public
as $$ select auth.uid() is not null $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
