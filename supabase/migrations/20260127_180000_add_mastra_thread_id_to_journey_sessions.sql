
begin;

alter table public.journey_sessions
  add column if not exists mastra_thread_id uuid;

create index if not exists idx_journey_sessions_mastra_thread_id
  on public.journey_sessions (mastra_thread_id);

commit;
