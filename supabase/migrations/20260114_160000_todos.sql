
begin;

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  thread_id text not null,
  title text not null,
  description text null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  tags text[] not null default '{}',
  parent_id uuid null references public.todos(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_todos_tenant_thread on public.todos(tenant_id, thread_id);
create index if not exists idx_todos_tenant_status on public.todos(tenant_id, status);

alter table public.todos enable row level security;

-- Minimal RLS: tenant isolation (assumes app sets tenant_id correctly)
create policy "todos_select_tenant" on public.todos
  for select
  using (tenant_id = auth.uid());

create policy "todos_insert_tenant" on public.todos
  for insert
  with check (tenant_id = auth.uid());

create policy "todos_update_tenant" on public.todos
  for update
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

commit;
