-- Interface schemas table for storing generated dashboard schemas
CREATE TABLE IF NOT EXISTS public.interface_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  interface_id UUID REFERENCES public.interfaces(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,

  -- Schema content
  schema_summary JSONB NOT NULL DEFAULT '{}',
  event_types TEXT[] DEFAULT '{}',
  sample_events JSONB DEFAULT '[]',

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.interface_schemas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own tenant interface_schemas"
  ON public.interface_schemas FOR SELECT
  USING (tenant_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Users can insert own tenant interface_schemas"
  ON public.interface_schemas FOR INSERT
  WITH CHECK (tenant_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Users can update own tenant interface_schemas"
  ON public.interface_schemas FOR UPDATE
  USING (tenant_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Users can delete own tenant interface_schemas"
  ON public.interface_schemas FOR DELETE
  USING (tenant_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access to interface_schemas"
  ON public.interface_schemas FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_interface_schemas_tenant ON public.interface_schemas(tenant_id);
CREATE INDEX idx_interface_schemas_interface ON public.interface_schemas(interface_id);
CREATE INDEX idx_interface_schemas_source ON public.interface_schemas(source_id);

-- Updated_at trigger
CREATE TRIGGER set_interface_schemas_updated_at
  BEFORE UPDATE ON public.interface_schemas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
