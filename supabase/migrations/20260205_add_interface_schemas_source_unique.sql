-- Add unique constraint on (tenant_id, source_id) for interface_schemas
-- This enables proper upsert behavior when syncing schema summaries

-- First, remove any duplicate records (keep the most recent one)
DELETE FROM public.interface_schemas a
USING public.interface_schemas b
WHERE a.id < b.id
  AND a.tenant_id = b.tenant_id
  AND a.source_id = b.source_id
  AND a.source_id IS NOT NULL;

-- Add the unique constraint
ALTER TABLE public.interface_schemas
ADD CONSTRAINT interface_schemas_tenant_source_unique
UNIQUE (tenant_id, source_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT interface_schemas_tenant_source_unique ON public.interface_schemas IS
'Ensures only one schema summary per source per tenant for proper upsert behavior';
