BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- P1 #8a: Fix SECURITY DEFINER views → security_invoker = true
--
-- Both views currently have NO security_invoker set (confirmed via
-- pg_options_to_table). This means they execute as the view owner,
-- bypassing RLS — any authenticated user could read all tenants' data.
--
-- Both views also have overly permissive grants (full CRUD to anon
-- and authenticated). Views are read-only — tighten to SELECT only.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Fix tenant_usage view ─────────────────────────────────
-- Confirmed columns: tenant_id, plan, plan_status, trial_ends_at,
-- has_card_on_file, portal_count, member_count, client_count
-- Confirmed source tables: tenants, client_portals, memberships, clients

DROP VIEW IF EXISTS public.tenant_usage;
CREATE VIEW public.tenant_usage
WITH (security_invoker = true)
AS
SELECT
  t.id AS tenant_id,
  t.plan,
  t.plan_status,
  t.trial_ends_at,
  t.has_card_on_file,
  (SELECT COUNT(*) FROM public.client_portals cp
   WHERE cp.tenant_id = t.id AND cp.status != 'archived') AS portal_count,
  (SELECT COUNT(*) FROM public.memberships m
   WHERE m.tenant_id = t.id AND m.invite_status = 'active') AS member_count,
  (SELECT COUNT(*) FROM public.clients c
   WHERE c.tenant_id = t.id AND c.status != 'archived') AS client_count
FROM public.tenants t;

-- Tighten grants: SELECT only for authenticated, revoke everything from anon
REVOKE ALL ON public.tenant_usage FROM anon;
REVOKE ALL ON public.tenant_usage FROM authenticated;
GRANT SELECT ON public.tenant_usage TO authenticated;
GRANT SELECT ON public.tenant_usage TO service_role;

-- ── 2. Fix portal_revenue_summary view ───────────────────────
-- Confirmed columns: portal_id, tenant_id, portal_name, surface_type,
-- pricing_type, price_cents, status, published_at, view_count,
-- customer_count, active_customers, total_revenue_cents, total_runs
-- Confirmed source tables: client_portals (aliased o), portal_customers (aliased pc)
-- Confirmed join: pc.portal_id = o.id

DROP VIEW IF EXISTS public.portal_revenue_summary;
CREATE VIEW public.portal_revenue_summary
WITH (security_invoker = true)
AS
SELECT
  o.id AS portal_id,
  o.tenant_id,
  o.name AS portal_name,
  o.surface_type,
  o.pricing_type,
  o.price_cents,
  o.status,
  o.published_at,
  o.view_count,
  (COUNT(pc.id))::integer AS customer_count,
  (COUNT(pc.id) FILTER (WHERE pc.subscription_status = 'active'))::integer AS active_customers,
  (COALESCE(SUM(pc.total_revenue_cents), 0))::bigint AS total_revenue_cents,
  (COALESCE(SUM(pc.total_runs), 0))::integer AS total_runs
FROM public.client_portals o
LEFT JOIN public.portal_customers pc ON pc.portal_id = o.id
GROUP BY o.id;

-- Tighten grants: SELECT only for authenticated, revoke everything from anon
REVOKE ALL ON public.portal_revenue_summary FROM anon;
REVOKE ALL ON public.portal_revenue_summary FROM authenticated;
GRANT SELECT ON public.portal_revenue_summary TO authenticated;
GRANT SELECT ON public.portal_revenue_summary TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- P1 #8b: Fix function search_paths (prevent search_path injection)
--
-- All 4 functions confirmed to have proconfig = null (no search_path set).
-- Exact signatures confirmed via pg_get_function_identity_arguments.
-- ═══════════════════════════════════════════════════════════════

-- SECURITY DEFINER functions (these bypass RLS — search_path is critical)
ALTER FUNCTION public.check_portal_limit(p_tenant_id uuid) SET search_path = public;
ALTER FUNCTION public.check_team_limit(p_tenant_id uuid) SET search_path = public;

-- Regular functions (not SECURITY DEFINER, but still best practice)
ALTER FUNCTION public.increment_view_count(p_offering_id uuid) SET search_path = public;
ALTER FUNCTION public.increment_revenue(p_subscription_id text, p_amount bigint) SET search_path = public;

COMMIT;
