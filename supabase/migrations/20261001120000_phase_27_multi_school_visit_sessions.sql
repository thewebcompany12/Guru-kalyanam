-- Phase 27: multi-school visit sessions
create table if not exists public.visit_sessions (
  id uuid primary key default gen_random_uuid(),
  visited_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_latitude double precision,
  start_longitude double precision,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.school_visits
  add column if not exists session_id uuid references public.visit_sessions(id) on delete set null;

create index if not exists idx_school_visits_session_id on public.school_visits(session_id);
create index if not exists idx_visit_sessions_started_at on public.visit_sessions(started_at desc);

alter table public.visit_sessions enable row level security;

drop policy if exists "authenticated read" on public.visit_sessions;
drop policy if exists "authenticated insert" on public.visit_sessions;
drop policy if exists "authenticated update" on public.visit_sessions;
drop policy if exists "authenticated delete" on public.visit_sessions;

create policy "authenticated read" on public.visit_sessions
  for select using ((select auth.uid()) is not null);

create policy "authenticated insert" on public.visit_sessions
  for insert with check ((select private.has_write_access()));

create policy "authenticated update" on public.visit_sessions
  for update using ((select private.has_write_access()))
  with check ((select private.has_write_access()));

create policy "authenticated delete" on public.visit_sessions
  for delete using ((select private.has_write_access()));
