-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_crowd_signal_reviews FROM anon;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_crowd_signal_reviews FROM authenticated;

GRANT DELETE, UPDATE ON public.evaluation_crowd_signal_reviews TO service_role;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_crowd_signals FROM anon;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.evaluation_crowd_signals FROM authenticated;

GRANT DELETE, UPDATE ON public.evaluation_crowd_signals TO service_role;