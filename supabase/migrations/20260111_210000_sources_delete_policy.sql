begin;

-- Add admin-only DELETE policy for sources (matches existing INSERT/UPDATE admin-only model)
drop policy if exists "Users can delete tenant sources" on public.sources;

create policy "Users can delete tenant sources"
on public.sources
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
