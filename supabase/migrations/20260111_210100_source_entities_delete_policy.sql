
begin;

-- Only do this if you want to enable RLS on source_entities.
-- If you do NOT want RLS enabled there yet, remove the ALTER TABLE line.
alter table public.source_entities enable row level security;

drop policy if exists "Users can delete tenant source_entities" on public.source_entities;

create policy "Users can delete tenant source_entities"
on public.source_entities
as permissive
for delete
to public
using (
  tenant_id in (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'admin'
  )
);

commit;

