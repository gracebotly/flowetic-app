-- Create clients table for agency CRM
-- Verified: this table does NOT exist in production as of March 2, 2026

BEGIN;

-- ═══════════════════════════════════════════════════════
-- 1. Create clients table
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  name            text NOT NULL,
  company         text NULL,
  contact_email   text NULL,
  contact_phone   text NULL,
  notes           text NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused')),
  health_score    integer NULL,
  last_seen_at    timestamptz NULL,
  archived_at     timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id
  ON public.clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_status
  ON public.clients (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_updated_at
  ON public.clients (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_health
  ON public.clients (tenant_id, health_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_last_seen
  ON public.clients (tenant_id, last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_clients_tags
  ON public.clients USING GIN (tags);

-- ═══════════════════════════════════════════════════════
-- 2. RLS Policies (matches existing pattern from offerings)
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SELECT: any tenant member can read
CREATE POLICY clients_select_tenant ON public.clients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = clients.tenant_id
    )
  );

-- INSERT: admin only
CREATE POLICY clients_insert_admin ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = clients.tenant_id
        AND m.role = 'admin'
    )
  );

-- UPDATE: admin only
CREATE POLICY clients_update_admin ON public.clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = clients.tenant_id
        AND m.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = clients.tenant_id
        AND m.role = 'admin'
    )
  );

-- DELETE: admin only
CREATE POLICY clients_delete_admin ON public.clients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = clients.tenant_id
        AND m.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════
-- 3. Fix offerings.client_id: change from text to uuid + add FK
--    Current state: text, nullable, no FK
--    Target state: uuid, nullable, FK → clients.id
-- ═══════════════════════════════════════════════════════
-- The existing value is NULL so the ALTER is safe.
ALTER TABLE public.offerings
  ALTER COLUMN client_id TYPE uuid USING client_id::uuid;

ALTER TABLE public.offerings
  ADD CONSTRAINT offerings_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offerings_client_id
  ON public.offerings (client_id) WHERE client_id IS NOT NULL;

COMMIT;
