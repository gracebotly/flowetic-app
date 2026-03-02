-- ============================================================
-- SETTINGS TAB PHASE 1 — Database Foundation
-- ============================================================

-- 1) Add missing columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_message text NOT NULL DEFAULT 'Welcome to your dashboard';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_footer text NOT NULL DEFAULT 'Powered by Your Agency';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Stripe columns (schema only — no UI in this phase)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id text NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false;

-- 2) Add invite columns to memberships
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invited_email text NULL;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invite_token text NULL;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'active'
  CHECK (invite_status IN ('pending', 'active', 'revoked'));
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Unique index on invite_token (partial — only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_invite_token
  ON memberships(invite_token) WHERE invite_token IS NOT NULL;

-- 4) Clean up duplicate SELECT policy on memberships
-- Currently two policies exist: "Users can view own memberships" and "memberships_select_own"
-- Both do the same thing (user_id = auth.uid()). Drop the duplicate.
DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
-- Keep "memberships_select_own" as the canonical SELECT policy.

-- 5) RLS: UPDATE on tenants (admin only)
DROP POLICY IF EXISTS tenants_update_admin ON public.tenants;
CREATE POLICY tenants_update_admin ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = tenants.id
        AND m.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = tenants.id
        AND m.role = 'admin'
    )
  );

-- 6) RLS: INSERT on memberships (admin only — for invites)
DROP POLICY IF EXISTS memberships_insert_admin ON public.memberships;
CREATE POLICY memberships_insert_admin ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = memberships.tenant_id
        AND m.role = 'admin'
    )
  );

-- 7) RLS: UPDATE on memberships (admin only — for role changes)
DROP POLICY IF EXISTS memberships_update_admin ON public.memberships;
CREATE POLICY memberships_update_admin ON public.memberships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = memberships.tenant_id
        AND m.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = memberships.tenant_id
        AND m.role = 'admin'
    )
  );

-- 8) RLS: DELETE on memberships (admin only — for removing members)
DROP POLICY IF EXISTS memberships_delete_admin ON public.memberships;
CREATE POLICY memberships_delete_admin ON public.memberships
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = memberships.tenant_id
        AND m.role = 'admin'
    )
  );

-- 9) Create Supabase Storage bucket for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
DROP POLICY IF EXISTS logos_upload_authenticated ON storage.objects;
CREATE POLICY logos_upload_authenticated ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Storage RLS: public read (logos are displayed on client portals)
DROP POLICY IF EXISTS logos_read_public ON storage.objects;
CREATE POLICY logos_read_public ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos');

-- Storage RLS: authenticated users can update their logo
DROP POLICY IF EXISTS logos_update_authenticated ON storage.objects;
CREATE POLICY logos_update_authenticated ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');

-- Storage RLS: authenticated users can delete their logo
DROP POLICY IF EXISTS logos_delete_authenticated ON storage.objects;
CREATE POLICY logos_delete_authenticated ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');
