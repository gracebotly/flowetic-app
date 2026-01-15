begin;

create table if not exists public.journey_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  thread_id text not null,
  role text not null check (role in ('system','user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_journey_messages_tenant_thread_created
  on public.journey_messages (tenant_id, thread_id, created_at);

alter table public.journey_messages enable row level security;

-- NOTE: adjust to your real tenant RLS pattern.
-- For now, mirror the existing (placeholder) journey_sessions policy style.
create policy "journey_messages_select_tenant" on public.journey_messages
  for select using (tenant_id = auth.uid());

create policy "journey_messages_insert_tenant" on public.journey_messages
  for insert with check (tenant_id = auth.uid());

commit;