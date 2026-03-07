-- ============================================================
-- Phase 6: Cross-Platform Entity Selection
-- ============================================================
-- Allows an offering to reference multiple entities across
-- different sources/platforms. Enables combined-overview dashboards
-- that pull data from both voice (Vapi/Retell) and workflow (Make/n8n).
--
-- Verified via Supabase MCP: this table does NOT exist.
-- offerings.source_id and offerings.entity_id remain for
-- backward compat (single-entity portals still use them).

BEGIN;

CREATE TABLE IF NOT EXISTS public.offering_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  entity_id   UUID NOT NULL REFERENCES public.source_entities(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(offering_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_offering_entities_offering
  ON public.offering_entities (offering_id);

CREATE INDEX IF NOT EXISTS idx_offering_entities_entity
  ON public.offering_entities (entity_id);

-- RLS
ALTER TABLE public.offering_entities ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member (via offering's tenant_id)
CREATE POLICY offering_entities_select ON public.offering_entities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offerings o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = offering_entities.offering_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT: admin only
CREATE POLICY offering_entities_insert ON public.offering_entities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offerings o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = offering_entities.offering_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- DELETE: admin only
CREATE POLICY offering_entities_delete ON public.offering_entities
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offerings o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = offering_entities.offering_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

COMMIT;
