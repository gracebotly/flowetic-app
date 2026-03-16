-- ============================================================
-- FIX BRANDING DEFAULTS V2
-- Set Getflowetic as the default brand_footer for new tenants
-- and backfill existing tenants with empty footers
-- ============================================================

-- 1) New tenants get Getflowetic branding by default
ALTER TABLE tenants ALTER COLUMN brand_footer SET DEFAULT 'Powered by Getflowetic';

-- 2) Existing tenants with empty brand_footer get the Getflowetic default
UPDATE tenants
SET brand_footer = 'Powered by Getflowetic', updated_at = now()
WHERE brand_footer = '' OR brand_footer IS NULL;
