-- DB safety net: prevent invalid style bundle IDs from persisting
ALTER TABLE public.journey_sessions
DROP CONSTRAINT IF EXISTS valid_style_bundle_id;

ALTER TABLE public.journey_sessions
ADD CONSTRAINT valid_style_bundle_id CHECK (
  selected_style_bundle_id IS NULL OR
  selected_style_bundle_id IN (
    'professional-clean', 'premium-dark', 'glass-premium', 'bold-startup',
    'corporate-trust', 'neon-cyber', 'pastel-soft', 'warm-earth', 'modern-saas'
  )
);

-- Fix any existing bad rows (display names stored instead of keys)
UPDATE public.journey_sessions
SET selected_style_bundle_id = 'modern-saas'
WHERE lower(selected_style_bundle_id) = 'modern saas'
   OR selected_style_bundle_id = 'Modern SaaS';
