
-- RPC function for upserting events with partial unique index support
-- Required because Supabase JS client doesn't support partial index ON CONFLICT

CREATE OR REPLACE FUNCTION upsert_events(p_events jsonb)
RETURNS TABLE(id uuid, is_new boolean) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event jsonb;
  v_id uuid;
  v_existing_id uuid;
BEGIN
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    -- Check if event already exists (only for events with platform_event_id)
    IF v_event->>'platform_event_id' IS NOT NULL THEN
      SELECT e.id INTO v_existing_id
      FROM public.events e
      WHERE e.tenant_id = (v_event->>'tenant_id')::uuid
        AND e.source_id = (v_event->>'source_id')::uuid
        AND e.platform_event_id = v_event->>'platform_event_id';
      
      IF v_existing_id IS NOT NULL THEN
        -- Update existing record
        UPDATE public.events SET
          type = COALESCE(v_event->>'type', type),
          name = COALESCE(v_event->>'name', name),
          value = COALESCE((v_event->>'value')::numeric, value),
          unit = COALESCE(v_event->>'unit', unit),
          text = COALESCE(v_event->>'text', text),
          state = COALESCE((v_event->'state')::jsonb, state),
          labels = COALESCE((v_event->'labels')::jsonb, labels),
          timestamp = COALESCE((v_event->>'timestamp')::timestamptz, timestamp)
        WHERE id = v_existing_id;
        
        id := v_existing_id;
        is_new := false;
        RETURN NEXT;
        CONTINUE;
      END IF;
    END IF;
    
    -- Insert new record
    INSERT INTO public.events (
      tenant_id, source_id, interface_id, run_id, type, name,
      value, unit, text, state, labels, timestamp, platform_event_id
    ) VALUES (
      (v_event->>'tenant_id')::uuid,
      (v_event->>'source_id')::uuid,
      (v_event->>'interface_id')::uuid,
      (v_event->>'run_id')::uuid,
      v_event->>'type',
      v_event->>'name',
      (v_event->>'value')::numeric,
      v_event->>'unit',
      v_event->>'text',
      (v_event->'state')::jsonb,
      COALESCE((v_event->'labels')::jsonb, '{}'::jsonb),
      COALESCE((v_event->>'timestamp')::timestamptz, now()),
      v_event->>'platform_event_id'
    )
    RETURNING events.id INTO v_id;
    
    id := v_id;
    is_new := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION upsert_events(jsonb) TO authenticated;
