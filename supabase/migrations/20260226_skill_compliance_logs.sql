BEGIN;

CREATE TABLE IF NOT EXISTS public.skill_compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  journey_thread_id TEXT NULL,
  phase TEXT NOT NULL,
  grounded BOOLEAN NOT NULL DEFAULT false,
  enforcement_decision TEXT NOT NULL DEFAULT 'allowed'
    CHECK (enforcement_decision IN ('allowed', 'warned', 'blocked')),

  -- Tool argument inspection (Upgrade 1)
  skill_searches JSONB NOT NULL DEFAULT '[]',
  design_tools_used TEXT[] NOT NULL DEFAULT '{}',
  business_skill_used BOOLEAN NOT NULL DEFAULT false,
  dashboard_skill_used BOOLEAN NOT NULL DEFAULT false,
  tool_calls JSONB NOT NULL DEFAULT '[]',

  -- Phase-specific enforcement (Upgrade 3)
  required_domains TEXT[] NOT NULL DEFAULT '{}',
  domains_satisfied TEXT[] NOT NULL DEFAULT '{}',
  domains_missing TEXT[] NOT NULL DEFAULT '{}',

  total_steps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_scl_tenant_phase ON public.skill_compliance_logs(tenant_id, phase);
CREATE INDEX idx_scl_grounded ON public.skill_compliance_logs(grounded) WHERE NOT grounded;
CREATE INDEX idx_scl_enforcement ON public.skill_compliance_logs(enforcement_decision)
  WHERE enforcement_decision != 'allowed';
CREATE INDEX idx_scl_created ON public.skill_compliance_logs(created_at DESC);

-- RLS
ALTER TABLE public.skill_compliance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scl_select_tenant" ON public.skill_compliance_logs
  FOR SELECT USING (tenant_id = auth.uid());

-- Insert uses service role key (bypasses RLS for server-side writes)
CREATE POLICY "scl_insert_service" ON public.skill_compliance_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.skill_compliance_logs IS
  'Structured compliance telemetry — records whether each chat stream was grounded in skill knowledge. Phase 3 of skills refactor.';

COMMIT;
