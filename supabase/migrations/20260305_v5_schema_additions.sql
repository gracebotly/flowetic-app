-- V5 Phase 1: Additive schema changes for revenue tracking
-- Verified: offerings table exists with 34 columns
-- Verified: view_count and published_at do NOT exist
-- Verified: offering_revenue_summary view does NOT exist
-- Verified: offering_customers table has: id, offering_id, tenant_id, email, name,
--           subscription_status, total_revenue_cents (bigint), total_runs, last_run_at, etc.

BEGIN;

-- 1. Track portal/product page views (feeds conversion metrics)
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- 2. Track when a portal/product was first published (separate from created_at)
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL;

-- 3. Backfill: set published_at = created_at for the 1 existing active offering
UPDATE public.offerings
  SET published_at = created_at
  WHERE status = 'active' AND published_at IS NULL;

-- 4. Revenue summary view (aggregates per offering, avoids scanning offering_customers every time)
-- Note: offering_customers.total_revenue_cents is bigint, so we cast the SUM result
CREATE OR REPLACE VIEW public.offering_revenue_summary AS
SELECT
  o.id AS offering_id,
  o.tenant_id,
  o.name AS offering_name,
  o.surface_type,
  o.pricing_type,
  o.price_cents,
  o.status,
  o.published_at,
  o.view_count,
  COUNT(oc.id)::integer AS customer_count,
  COUNT(oc.id)::integer FILTER (WHERE oc.subscription_status = 'active') AS active_customers,
  COALESCE(SUM(oc.total_revenue_cents), 0)::bigint AS total_revenue_cents,
  COALESCE(SUM(oc.total_runs), 0)::integer AS total_runs
FROM public.offerings o
LEFT JOIN public.offering_customers oc ON oc.offering_id = o.id
GROUP BY o.id;

COMMIT;
