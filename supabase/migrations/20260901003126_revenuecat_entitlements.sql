-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.households
  DROP COLUMN premium_active;

ALTER TABLE public.households
  DROP COLUMN premium_expires_at;

ALTER TABLE public.households
  DROP COLUMN premium_updated_at;

ALTER TABLE public.households
  ADD COLUMN plus_active boolean DEFAULT false NOT NULL;

ALTER TABLE public.households
  ADD COLUMN plus_expires_at timestamp with time zone;

ALTER TABLE public.households
  ADD COLUMN plus_updated_at timestamp with time zone;

ALTER TABLE public.households
  ADD COLUMN ai_active boolean DEFAULT false NOT NULL;

ALTER TABLE public.households
  ADD COLUMN ai_expires_at timestamp with time zone;

ALTER TABLE public.households
  ADD COLUMN ai_updated_at timestamp with time zone;

ALTER TABLE public.households
  ADD COLUMN ai_subscriber_id uuid;

ALTER TABLE public.households
  ADD CONSTRAINT households_active_ai_has_subscriber CHECK (NOT ai_active OR ai_subscriber_id IS NOT NULL);

ALTER TABLE public.households
  ADD CONSTRAINT households_ai_subscriber_id_fkey FOREIGN KEY (ai_subscriber_id) REFERENCES public.profiles(id) ON DELETE SET NULL;