BEGIN;
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS selected_layout TEXT NULL;
COMMENT ON COLUMN public.journey_sessions.selected_layout IS
  'Layout wireframe selection from recommend phase (e.g. "funnel-view", "grid-ops", "timeline-flow"). Must be set before advancing to style phase.';
COMMIT;
