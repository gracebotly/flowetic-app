-- ═══════════════════════════════════════════════════════════════
-- Phase 5B: Atomic revenue increment function
-- Called from webhook handler on invoice.paid events
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_revenue(
  p_subscription_id TEXT,
  p_amount BIGINT
) RETURNS BIGINT AS $$
DECLARE
  v_new_total BIGINT;
BEGIN
  UPDATE public.offering_customers
  SET total_revenue_cents = total_revenue_cents + p_amount,
      last_payment_at = NOW()
  WHERE stripe_subscription_id = p_subscription_id
  RETURNING total_revenue_cents INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
