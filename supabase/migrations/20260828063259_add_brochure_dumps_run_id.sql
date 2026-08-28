-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.brochure_dumps
  ADD COLUMN run_id text DEFAULT 'legacy'::text NOT NULL;

CREATE UNIQUE INDEX brochure_dumps_zip_code_run_id_idx ON public.brochure_dumps (zip_code, run_id);