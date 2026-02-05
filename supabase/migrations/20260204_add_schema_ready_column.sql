-- Add schema_ready column to journey_sessions
ALTER TABLE public.journey_sessions
ADD COLUMN IF NOT EXISTS schema_ready BOOLEAN DEFAULT FALSE;

-- Add index for filtering by schema_ready
CREATE INDEX IF NOT EXISTS idx_journey_sessions_schema_ready
ON public.journey_sessions(schema_ready)
WHERE schema_ready = TRUE;

-- Comment for documentation
COMMENT ON COLUMN public.journey_sessions.schema_ready IS
'Indicates whether the interface schema has been generated and is ready for preview';
