

begin;

alter table public.journey_sessions
add column if not exists schema_ready boolean not null default false;

create index if not exists idx_journey_sessions_tenant_thread_schema_ready
on public.journey_sessions(tenant_id, thread_id, schema_ready);

commit;


