-- ═══════════════════════════════════════════════════════════════
-- Phase 5A: Stripe Connect — Extend existing tables + create webhook log
-- ═══════════════════════════════════════════════════════════════
-- NOTE: stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled
--       already exist on tenants (from settings migration). Do NOT re-add them.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Extend tenants table (only MISSING columns) ──────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_application_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ;

-- Unique index on stripe_account_id (partial — only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_account
  ON public.tenants (stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- ── Extend offering_customers (subscription tracking for Phase 5B) ──
ALTER TABLE public.offering_customers
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_revenue_cents BIGINT NOT NULL DEFAULT 0;

-- ── Extend workflow_executions (payment tracking for Phase 5B) ──
ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free'
    CHECK (payment_status IN ('free', 'pending', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- ── Extend offerings (metering for Phase 5C) ─────────────────
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS stripe_meter_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_meter_event_name TEXT;

-- ── Stripe webhook event log (NEW TABLE) ──────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,                 -- evt_xxxxx (Stripe event ID = idempotency key)
  type TEXT NOT NULL,                  -- event type string
  tenant_id UUID,                      -- resolved tenant (nullable — some events are platform-level)
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type
  ON public.stripe_webhook_events (type, processed);

CREATE INDEX IF NOT EXISTS idx_stripe_events_tenant
  ON public.stripe_webhook_events (tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only — webhooks use service key, never user auth
CREATE POLICY stripe_events_service_only
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
