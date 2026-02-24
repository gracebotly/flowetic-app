BEGIN;

ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS proposals JSONB DEFAULT NULL;

COMMENT ON COLUMN public.journey_sessions.proposals IS
  'Array of 2-3 generated proposals from the propose phase. Each element contains: archetype, emphasisBlend, designSystem, wireframeLayout, reasoning. NULL for legacy 6-phase journeys.';

ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS selected_proposal_index INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.journey_sessions.selected_proposal_index IS
  'Index (0-based) into the proposals JSONB array indicating which proposal the user selected. NULL until user makes a choice. Triggers transition from propose → build_edit phase.';

ALTER TABLE public.journey_sessions
ADD CONSTRAINT valid_selected_proposal_index CHECK (
  selected_proposal_index IS NULL
  OR (selected_proposal_index >= 0 AND selected_proposal_index <= 4)
);

COMMIT;
