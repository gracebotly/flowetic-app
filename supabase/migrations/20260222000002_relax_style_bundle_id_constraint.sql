-- ============================================================================
-- Relax style bundle ID constraint to allow custom style names
-- ============================================================================
-- The previous migration (20260221200000) replaced the old strict constraint
-- with one that still limits to 9 preset slugs + 'custom'. The product vision
-- requires LLM-generated custom names like "Neon Voice Command Center" or
-- "Midnight Legal Suite". This migration replaces the constraint with a
-- simple non-empty-string check.
-- ============================================================================

-- Drop the existing restrictive constraint
ALTER TABLE public.journey_sessions
DROP CONSTRAINT IF EXISTS valid_style_bundle_id;

-- Add permissive constraint: just validate non-empty when set
ALTER TABLE public.journey_sessions
ADD CONSTRAINT valid_style_bundle_id CHECK (
  selected_style_bundle_id IS NULL
  OR length(trim(selected_style_bundle_id)) > 0
);

COMMENT ON CONSTRAINT valid_style_bundle_id ON public.journey_sessions IS
  'Allows any non-empty string: preset slugs, "custom", or LLM-generated names like "Neon Voice Command Center"';
