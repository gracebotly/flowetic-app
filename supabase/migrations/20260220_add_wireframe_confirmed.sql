BEGIN;
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS wireframe_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN public.journey_sessions.wireframe_confirmed IS
  'True when user has reviewed and approved the wireframe preview in the recommend phase. Must be true (along with selected_outcome) before autoAdvancePhase transitions recommend → style.';
COMMIT;
