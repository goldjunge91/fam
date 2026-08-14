-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.households
  ADD COLUMN premium_active boolean DEFAULT false NOT NULL;

ALTER TABLE public.households
  ADD COLUMN premium_expires_at timestamp with time zone;

ALTER TABLE public.households
  ADD COLUMN premium_updated_at timestamp with time zone;

REVOKE UPDATE ON public.households FROM authenticated;

GRANT UPDATE (name) ON public.households TO authenticated;
