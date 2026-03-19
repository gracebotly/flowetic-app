-- ============================================================
-- Rate limiting via Supabase RPC
-- Uses a lightweight table + atomic upsert function.
-- Old entries are cleaned up lazily inside the RPC itself.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key        TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count  INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_hits       INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_hit_count    INTEGER;
  v_allowed      BOOLEAN;
  v_remaining    INTEGER;
  v_reset_ms     INTEGER;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, hit_count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
    SET
      window_start = CASE
        WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now
        THEN v_now
        ELSE rate_limits.window_start
      END,
      hit_count = CASE
        WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL <= v_now
        THEN 1
        ELSE rate_limits.hit_count + 1
      END
  RETURNING rate_limits.window_start, rate_limits.hit_count
  INTO v_window_start, v_hit_count;

  v_allowed   := v_hit_count <= p_max_hits;
  v_remaining := GREATEST(0, p_max_hits - v_hit_count);
  v_reset_ms  := GREATEST(0,
    EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::INTERVAL) - v_now)::INTEGER * 1000
  );

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE window_start < v_now - (p_window_seconds * 2 || ' seconds')::INTERVAL;
  END IF;

  RETURN jsonb_build_object(
    'allowed',   v_allowed,
    'remaining', v_remaining,
    'reset_ms',  v_reset_ms
  );
END;
$$;
