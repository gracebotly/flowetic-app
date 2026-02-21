-- ============================================================================
-- Premium Design System: custom tokens column + relax preset constraints
-- ============================================================================

-- 1. Add design_tokens JSONB column
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS design_tokens JSONB DEFAULT NULL;

-- 2. Add style_confirmed boolean
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS style_confirmed BOOLEAN DEFAULT FALSE;

-- 3. Drop the strict preset-only CHECK constraint
ALTER TABLE public.journey_sessions
DROP CONSTRAINT IF EXISTS valid_style_bundle_id;

-- 4. Add loose constraint: allow NULL, known slugs, OR 'custom'
ALTER TABLE public.journey_sessions
ADD CONSTRAINT valid_style_bundle_id CHECK (
  selected_style_bundle_id IS NULL OR
  selected_style_bundle_id IN (
    'professional-clean', 'premium-dark', 'glass-premium', 'bold-startup',
    'corporate-trust', 'neon-cyber', 'pastel-soft', 'warm-earth', 'modern-saas',
    'custom'
  )
);

-- 5. Comments
COMMENT ON COLUMN public.journey_sessions.design_tokens IS
  'LLM-generated custom design system: { colors: { primary, secondary, accent, success, warning, error, background, text }, fonts: { heading, body }, spacing: { unit }, radius, shadow, charts, uxGuidelines, style: { name, type, keywords, effects }, reasoning }';

COMMENT ON COLUMN public.journey_sessions.style_confirmed IS
  'True when user has approved the generated design system';
