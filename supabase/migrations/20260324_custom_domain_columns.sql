BEGIN;

-- domain_verified: tracks whether DNS verification passed
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false;

-- domain_verification_data: stores Vercel API response (TXT record values, etc.)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_verification_data jsonb NULL;

-- domain_added_at: when the domain was first registered
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_added_at timestamptz NULL;

-- domain_verified_at: when DNS verification completed
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_verified_at timestamptz NULL;

-- custom_domain itself (IF NOT EXISTS handles the case where it was added directly)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS custom_domain text NULL;

-- Index for middleware domain lookup (critical path — every custom domain request)
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain
  ON public.tenants (custom_domain)
  WHERE custom_domain IS NOT NULL AND domain_verified = true;

-- Unique constraint: no two tenants can claim the same domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain_unique
  ON public.tenants (custom_domain)
  WHERE custom_domain IS NOT NULL;

COMMIT;
