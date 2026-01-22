

begin;

create index if not exists idx_events_tenant_source
on public.events(tenant_id, source_id);

create index if not exists idx_events_tenant_name
on public.events(tenant_id, name);

create index if not exists idx_events_tenant_timestamp
on public.events(tenant_id, "timestamp" desc);

create index if not exists idx_events_tenant_source_timestamp
on public.events(tenant_id, source_id, "timestamp" desc);

commit;

