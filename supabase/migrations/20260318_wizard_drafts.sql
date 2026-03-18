BEGIN;

CREATE TABLE IF NOT EXISTS public.wizard_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  wizard_state jsonb NOT NULL,
  current_step integer NOT NULL DEFAULT 1,
  user_edited_name boolean NOT NULL DEFAULT false,
  draft_name text NOT NULL DEFAULT 'Untitled draft',
  platform_type text NULL,
  surface_type text NOT NULL DEFAULT 'analytics',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One draft per tenant
CREATE UNIQUE INDEX IF NOT EXISTS wizard_drafts_tenant_unique
  ON public.wizard_drafts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_wizard_drafts_user
  ON public.wizard_drafts (user_id);

ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

-- RLS: matches client_portals pattern (membership-based, not admin-only)
CREATE POLICY tenant_select_wizard_drafts ON public.wizard_drafts
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
  ));

CREATE POLICY tenant_insert_wizard_drafts ON public.wizard_drafts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
  ));

CREATE POLICY tenant_update_wizard_drafts ON public.wizard_drafts
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
  ));

CREATE POLICY tenant_delete_wizard_drafts ON public.wizard_drafts
  FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM memberships m WHERE m.user_id = auth.uid()
  ));

COMMIT;
