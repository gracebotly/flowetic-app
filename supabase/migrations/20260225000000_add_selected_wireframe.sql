-- Add selected_wireframe JSONB column to journey_sessions
-- Stores the wireframe layout from the selected proposal so the builder
-- can use it as the layout template instead of generating from scratch.

BEGIN;

ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS selected_wireframe JSONB DEFAULT NULL;

COMMENT ON COLUMN public.journey_sessions.selected_wireframe IS
  'Wireframe layout from the selected proposal. Shape: { name: string, components: [{ id, type, label, layout: { col, row, w, h } }] }. Used by generateUISpec as the primary layout template.';

COMMIT;
