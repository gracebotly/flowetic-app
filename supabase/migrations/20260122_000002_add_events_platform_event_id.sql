


begin;

alter table public.events
add column if not exists platform_event_id text;

create unique index if not exists idx_events_unique_source_platform_event
on public.events(source_id, platform_event_id)
where platform_event_id is not null;

commit;


