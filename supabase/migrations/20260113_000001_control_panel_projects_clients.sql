

-- Control Panel v2.0 tables: projects, clients, project_access, activity_events
-- Admin-only write. Tenant members can read.

begin;

-- 1) projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  type text not null check (type in ('analytics','tool','form')),
  status text not null check (status in ('draft','live')),
  description text null,
  public_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_tenant_id on public.projects (tenant_id);
create index if not exists idx_projects_tenant_updated_at on public.projects (tenant_id, updated_at desc);
create index if not exists idx_projects_tenant_status on public.projects (tenant_id, status);
create index if not exists idx_projects_tenant_type on public.projects (tenant_id, type);

alter table public.projects enable row level security;

-- 2) clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  contact_email text null,
  contact_phone text null,
  subdomain text not null,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_tenant_subdomain_key on public.clients (tenant_id, subdomain);
create index if not exists idx_clients_tenant_id on public.clients (tenant_id);
create index if not exists idx_clients_tenant_updated_at on public.clients (tenant_id, updated_at desc);

alter table public.clients enable row level security;

-- 3) project_access (many-to-many)
create table if not exists public.project_access (
  tenant_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, client_id)
);

create index if not exists idx_project_access_tenant on public.project_access (tenant_id);
create index if not exists idx_project_access_project on public.project_access (project_id);
create index if not exists idx_project_access_client on public.project_access (client_id);

alter table public.project_access enable row level security;

-- 4) activity_events (minimal for now; used later for Activity tab)
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  type text not null, -- 'projects' | 'clients' | 'connections' | 'system'
  status text not null default 'success' check (status in ('success','warning','error')),
  client_id uuid null references public.clients(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  message text not null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_events_tenant_created on public.activity_events (tenant_id, created_at desc);
create index if not exists idx_activity_events_tenant_type on public.activity_events (tenant_id, type);

alter table public.activity_events enable row level security;

-- Helper: tenant membership check (read access)
-- We assume memberships table exists: public.memberships(user_id, tenant_id, role)
-- Policies use auth.uid().

-- ===== POLICIES: projects =====
drop policy if exists projects_select_tenant on public.projects;
create policy projects_select_tenant
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = projects.tenant_id
  )
);

drop policy if exists projects_insert_admin on public.projects;
create policy projects_insert_admin
on public.projects
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = projects.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists projects_update_admin on public.projects;
create policy projects_update_admin
on public.projects
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = projects.tenant_id
      and m.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = projects.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists projects_delete_admin on public.projects;
create policy projects_delete_admin
on public.projects
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = projects.tenant_id
      and m.role = 'admin'
  )
);

-- ===== POLICIES: clients =====
drop policy if exists clients_select_tenant on public.clients;
create policy clients_select_tenant
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = clients.tenant_id
  )
);

drop policy if exists clients_insert_admin on public.clients;
create policy clients_insert_admin
on public.clients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = clients.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists clients_update_admin on public.clients;
create policy clients_update_admin
on public.clients
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = clients.tenant_id
      and m.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = clients.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin
on public.clients
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = clients.tenant_id
      and m.role = 'admin'
  )
);

-- ===== POLICIES: project_access =====
drop policy if exists project_access_select_tenant on public.project_access;
create policy project_access_select_tenant
on public.project_access
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = project_access.tenant_id
  )
);

drop policy if exists project_access_write_admin on public.project_access;
create policy project_access_write_admin
on public.project_access
for all
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = project_access.tenant_id
      and m.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = project_access.tenant_id
      and m.role = 'admin'
  )
);

-- ===== POLICIES: activity_events =====
drop policy if exists activity_events_select_tenant on public.activity_events;
create policy activity_events_select_tenant
on public.activity_events
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = activity_events.tenant_id
  )
);

drop policy if exists activity_events_insert_admin on public.activity_events;
create policy activity_events_insert_admin
on public.activity_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = activity_events.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists activity_events_update_admin on public.activity_events;
create policy activity_events_update_admin
on public.activity_events
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = activity_events.tenant_id
      and m.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = activity_events.tenant_id
      and m.role = 'admin'
  )
);

drop policy if exists activity_events_delete_admin on public.activity_events;
create policy activity_events_delete_admin
on public.activity_events
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = activity_events.tenant_id
      and m.role = 'admin'
  )
);

commit;

