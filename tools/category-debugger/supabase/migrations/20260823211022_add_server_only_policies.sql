-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE POLICY evaluation_server_only ON public.evaluation_labels
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY evaluation_server_only ON public.evaluation_reviewers
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY evaluation_server_only ON public.evaluation_run_predictions
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY evaluation_server_only ON public.evaluation_runs
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);