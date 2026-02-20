-- Fix: get_data_driven_entities was counting internal agent events (state, tool_event)
-- These are bookkeeping events from the Mastra agent thread, not user workflow data.
-- This inflated "total events" from 13 (actual workflow executions) to 66.
CREATE OR REPLACE FUNCTION get_data_driven_entities(
  p_tenant_id UUID,
  p_source_id UUID,
  p_since_days INT DEFAULT 30
)
RETURNS TABLE(
  has_data BOOLEAN,
  entities JSONB,
  total_events BIGINT,
  date_range JSONB
) AS $$
DECLARE
  v_since_date TIMESTAMPTZ;
  v_earliest TIMESTAMPTZ;
  v_latest TIMESTAMPTZ;
  v_total BIGINT;
  v_entities JSONB;
BEGIN
  v_since_date := NOW() - (p_since_days || ' days')::INTERVAL;
  -- ✅ FIX: Exclude internal event types from counts
  -- 'state' events = agent thread bookkeeping (e.g., "thread_event" named state events)
  -- 'tool_event' events = internal tool execution traces
  -- These are NOT user workflow data and inflate counts (48 state + 1 tool = 49 noise events)
  SELECT
    MIN(timestamp),
    MAX(timestamp),
    COUNT(*)
  INTO v_earliest, v_latest, v_total
  FROM public.events
  WHERE tenant_id = p_tenant_id
    AND source_id = p_source_id
    AND timestamp >= v_since_date
    AND type NOT IN ('state', 'tool_event');
  IF v_total = 0 OR v_total IS NULL THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      '[]'::JSONB,
      0::BIGINT,
      jsonb_build_object(
        'earliest', NULL,
        'latest', NULL
      );
    RETURN;
  END IF;
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(grouped.name, 'unnamed'),
      'type', COALESCE(grouped.type, 'unknown'),
      'count', grouped.event_count,
      'latestTimestamp', grouped.latest_ts,
      'distinctFields', COALESCE(grouped.distinct_fields, ARRAY[]::TEXT[])
    ) ORDER BY grouped.event_count DESC
  )
  INTO v_entities
  FROM (
    SELECT
      e.name,
      e.type,
      COUNT(*) as event_count,
      MAX(e.timestamp) as latest_ts,
      (
        SELECT array_agg(DISTINCT k ORDER BY k)
        FROM (
          SELECT jsonb_object_keys(sub.state) AS k
          FROM public.events sub
          WHERE sub.tenant_id = p_tenant_id
            AND sub.source_id = p_source_id
            AND sub.timestamp >= v_since_date
            AND sub.name IS NOT DISTINCT FROM e.name
            AND sub.type IS NOT DISTINCT FROM e.type
            AND sub.state IS NOT NULL
            AND jsonb_typeof(sub.state) = 'object'
          UNION
          SELECT jsonb_object_keys(sub.labels) AS k
          FROM public.events sub
          WHERE sub.tenant_id = p_tenant_id
            AND sub.source_id = p_source_id
            AND sub.timestamp >= v_since_date
            AND sub.name IS NOT DISTINCT FROM e.name
            AND sub.type IS NOT DISTINCT FROM e.type
            AND sub.labels IS NOT NULL
            AND jsonb_typeof(sub.labels) = 'object'
        ) all_keys
      ) as distinct_fields
    FROM public.events e
    WHERE e.tenant_id = p_tenant_id
      AND e.source_id = p_source_id
      AND e.timestamp >= v_since_date
      -- ✅ FIX: Same filter in entity aggregation
      AND e.type NOT IN ('state', 'tool_event')
    GROUP BY e.name, e.type
  ) grouped;
  RETURN QUERY SELECT
    true::BOOLEAN,
    COALESCE(v_entities, '[]'::JSONB),
    v_total,
    jsonb_build_object(
      'earliest', v_earliest,
      'latest', v_latest
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
