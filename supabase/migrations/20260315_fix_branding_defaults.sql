-- ============================================================
-- FIX BRANDING DEFAULTS
-- 20260315 — Align DB defaults with production branding cleanup
-- ============================================================

-- 1) Change the column default for brand_footer from
--    'Powered by Your Agency' to empty string.
--    New tenants will get '' which makes PortalShell render
--    "© {year} {tenant.name}" automatically.
ALTER TABLE tenants ALTER COLUMN brand_footer SET DEFAULT '';

-- 2) Update existing tenants still on the old default.
--    Only touches tenants that never changed their footer.
UPDATE tenants
SET brand_footer = '', updated_at = now()
WHERE brand_footer = 'Powered by Your Agency';

-- 3) Also clean up any tenants on the code-level default
--    that was never in the DB but appears in resolveBranding.ts
UPDATE tenants
SET brand_footer = '', updated_at = now()
WHERE brand_footer = 'Powered by Getflowetic';
