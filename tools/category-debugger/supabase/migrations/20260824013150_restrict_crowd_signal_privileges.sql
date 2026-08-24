-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.evaluation_crowd_signal_reviews FROM service_role;

REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.evaluation_crowd_signals FROM service_role;