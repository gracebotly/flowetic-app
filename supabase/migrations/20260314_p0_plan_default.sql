-- P0 prelaunch blocker: ensure tenant plan has a reliable default.
-- Backfill null/empty plan values and enforce default at schema level.

UPDATE public.tenants
SET plan = 'agency'
WHERE plan IS NULL OR btrim(plan) = '';

ALTER TABLE public.tenants
ALTER COLUMN plan SET DEFAULT 'agency';
