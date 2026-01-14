


begin;

create table if not exists public.journey_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  thread_id text not null,
  platform_type text not null,
  source_id uuid null,
  entity_id uuid null,
  mode text not null default 'select_entity',
  selected_outcome text null,
  selected_storyboard text null,
  selected_style_bundle_id text null,
  density_preset text not null default 'comfortable',
  palette_override_id text null,
  preview_interface_id uuid null,
  preview_version_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journey_sessions_tenant_thread
  on public.journey_sessions(tenant_id, thread_id);

alter table public.journey_sessions enable row level security;

-- Minimal RLS placeholder; align with your existing tenant policy pattern
create policy "journey_sessions_select_tenant" on public.journey_sessions
  for select
  using (tenant_id = auth.uid());

create policy "journey_sessions_insert_tenant" on public.journey_sessions
  for insert
  with check (tenant_id = auth.uid());

create policy "journey_sessions_update_tenant" on public.journey_sessions
  for update
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

commit;


