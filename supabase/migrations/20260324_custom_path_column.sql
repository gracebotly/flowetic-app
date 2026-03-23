BEGIN;

-- custom_path: agency-controlled clean URL path for custom domains
-- e.g., "invoice-tracker" → portal.smith.agency/invoice-tracker
ALTER TABLE public.client_portals
  ADD COLUMN IF NOT EXISTS custom_path text NULL;

-- Backfill existing portals: generate custom_path from name
-- Same logic as generateCleanSlug() in the app code:
--   lowercase → replace non-alnum with hyphens → trim hyphens → truncate to 60 chars
UPDATE public.client_portals
SET custom_path = left(
  trim(BOTH '-' FROM
    regexp_replace(
      regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)', '', 'g'
    )
  ),
  60
)
WHERE custom_path IS NULL;

-- Handle any within-tenant collisions from the backfill
-- (Append portal ID prefix to make unique)
WITH dupes AS (
  SELECT id, tenant_id, custom_path,
    ROW_NUMBER() OVER (PARTITION BY tenant_id, custom_path ORDER BY created_at) as rn
  FROM public.client_portals
  WHERE custom_path IS NOT NULL
)
UPDATE public.client_portals cp
SET custom_path = cp.custom_path || '-' || left(cp.id::text, 4)
FROM dupes d
WHERE cp.id = d.id AND d.rn > 1;

-- Unique per tenant: no two portals from the same agency can share a path
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portals_tenant_custom_path
  ON public.client_portals (tenant_id, custom_path)
  WHERE custom_path IS NOT NULL;

-- Index for middleware path lookup (critical path — every custom domain request)
-- Middleware knows tenant_id (from domain lookup) and custom_path (from URL)
CREATE INDEX IF NOT EXISTS idx_client_portals_custom_path_lookup
  ON public.client_portals (tenant_id, custom_path)
  WHERE custom_path IS NOT NULL AND status = 'active';

COMMIT;
