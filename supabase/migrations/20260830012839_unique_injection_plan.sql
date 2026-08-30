-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

DROP INDEX public.injection_plans_user_id_idx;

CREATE UNIQUE INDEX injection_plans_user_id_idx ON public.injection_plans (user_id);