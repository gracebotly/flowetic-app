-- ============================================================
-- Phase 5: White-Label Branding — Add favicon + default theme
-- ============================================================
-- Verified via Supabase MCP: these columns do NOT yet exist.
-- Existing columns (no changes): logo_url, primary_color,
-- secondary_color, welcome_message, brand_footer

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS favicon_url TEXT NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_theme TEXT NOT NULL DEFAULT 'dark'
  CHECK (default_theme IN ('light', 'dark'));

COMMENT ON COLUMN public.tenants.favicon_url IS
  'URL to agency favicon (PNG/ICO). Propagated to client portal <head>.';

COMMENT ON COLUMN public.tenants.default_theme IS
  'Default theme for client portals: light or dark. Client can still toggle.';

COMMIT;
