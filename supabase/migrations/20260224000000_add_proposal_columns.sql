-- ============================================================================
-- Add proposal columns to journey_sessions for 2-phase journey
-- ============================================================================

-- 1. Add proposals JSONB column (stores the 2-3 generated proposals)
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS proposals JSONB DEFAULT NULL;

-- 2. Add selected_proposal_index (which proposal the user picked: 0, 1, or 2)
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS selected_proposal_index INTEGER DEFAULT NULL;

-- 3. Add archetype classification result
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS archetype JSONB DEFAULT NULL;

-- 4. Migrate old mode values to new phases
-- Any session stuck in old phases gets mapped to 'propose'
UPDATE public.journey_sessions
SET mode = 'propose'
WHERE mode IN ('select_entity', 'recommend', 'style');

-- Sessions in build/edit phases get mapped to 'build_edit'
UPDATE public.journey_sessions
SET mode = 'build_edit'
WHERE mode IN ('build_preview', 'interactive_edit');

-- 'deploy' stays as 'deploy' (no change needed)

-- 5. Update the mode default for new sessions
ALTER TABLE public.journey_sessions
ALTER COLUMN mode SET DEFAULT 'propose';

-- 6. Comments
COMMENT ON COLUMN public.journey_sessions.proposals IS
  'Array of 2-3 AI-generated dashboard proposals: [{ name, description, emphasisBlend, designSystem, wireframe, reasoning }]';

COMMENT ON COLUMN public.journey_sessions.selected_proposal_index IS
  'Index (0-based) of the proposal the user selected';

COMMENT ON COLUMN public.journey_sessions.archetype IS
  'Workflow archetype classification: { archetype, confidence, emphasisBlend: { dashboard, product, analytics } }';
