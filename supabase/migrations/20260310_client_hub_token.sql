-- Add hub_token to clients for the client hub page
-- Confirmed: column absent as of March 2026 (verified via Supabase MCP)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hub_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clients_hub_token
  ON public.clients (hub_token)
  WHERE hub_token IS NOT NULL;
