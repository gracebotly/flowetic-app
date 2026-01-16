begin;


-- TODOS
alter table public.todos enable row level security;


drop policy if exists "todos_select_tenant" on public.todos;
drop policy if exists "todos_insert_tenant" on public.todos;
drop policy if exists "todos_update_tenant" on public.todos;


create policy "todos_select_tenant"
on public.todos
for select
to authenticated
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


create policy "todos_insert_tenant"
on public.todos
for insert
to authenticated
with check (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


create policy "todos_update_tenant"
on public.todos
for update
to authenticated
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
)
with check (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


-- JOURNEY SESSIONS
alter table public.journey_sessions enable row level security;


drop policy if exists "journey_sessions_select_tenant" on public.journey_sessions;
drop policy if exists "journey_sessions_insert_tenant" on public.journey_sessions;
drop policy if exists "journey_sessions_update_tenant" on public.journey_sessions;


create policy "journey_sessions_select_tenant"
on public.journey_sessions
for select
to authenticated
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


create policy "journey_sessions_insert_tenant"
on public.journey_sessions
for insert
to authenticated
with check (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


create policy "journey_sessions_update_tenant"
on public.journey_sessions
for update
to authenticated
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
)
with check (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


-- JOURNEY MESSAGES
alter table public.journey_messages enable row level security;


drop policy if exists "journey_messages_select_tenant" on public.journey_messages;
drop policy if exists "journey_messages_insert_tenant" on public.journey_messages;


create policy "journey_messages_select_tenant"
on public.journey_messages
for select
to authenticated
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


create policy "journey_messages_insert_tenant"
on public.journey_messages
for insert
to authenticated
with check (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
);


commit;