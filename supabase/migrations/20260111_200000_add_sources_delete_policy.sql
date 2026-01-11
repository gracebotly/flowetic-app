
-- Add DELETE policy for sources (admin-only), consistent with existing INSERT/UPDATE policies.
-- This fixes "delete does nothing" because sources has RLS enabled and previously had no DELETE policy.

begin;

-- SOURCES: allow admins of the tenant to delete sources
drop policy if exists "Users can delete tenant sources" on public.sources;

create policy "Users can delete tenant sources"
on public.sources
as permissive
for delete
to public
using (
  tenant_id in (
    select memberships.tenant_id
    from public.memberships
    where memberships.user_id = auth.uid()
      and memberships.role = 'admin'
  )
);

-- SOURCE_ENTITIES: currently RLS is disabled per your diagnostics, but add policy anyway
-- so if/when RLS is enabled, deletes won't break.
-- This policy matches the same admin-only model.
alter table public.source_entities enable row level security;

drop policy if exists "Users can delete tenant source_entities" on public.source_entities;

create policy "Users can delete tenant source_entities"
on public.source_entities
as permissive
for delete
to public
using (
  tenant_id in (
    select memberships.tenant_id
    from public.memberships
    where memberships.user_id = auth.uid()
      and memberships.role = 'admin'
  )
);

commit;
