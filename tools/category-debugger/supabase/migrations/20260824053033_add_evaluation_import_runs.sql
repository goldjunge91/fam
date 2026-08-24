-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.evaluation_import_runs (
  run_id            uuid                     NOT NULL,
  source            text                     NOT NULL,
  status            text                     NOT NULL,
  started_at        timestamp with time zone NOT NULL,
  finished_at       timestamp with time zone,
  cursor_created_at timestamp with time zone,
  cursor_event_id   text,
  pages             integer                  DEFAULT 0 NOT NULL,
  events_read       integer                  DEFAULT 0 NOT NULL,
  events_imported   integer                  DEFAULT 0 NOT NULL,
  events_duplicate  integer                  DEFAULT 0 NOT NULL,
  error_message     text
);

ALTER TABLE public.evaluation_import_runs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_completion_check
    CHECK (status = 'running'::text AND finished_at IS NULL AND error_message IS NULL OR status = 'completed'::text AND finished_at IS
    NOT NULL AND error_message IS NULL OR status = 'failed'::text AND finished_at IS NOT NULL AND error_message IS NOT NULL);

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_counts_check
    CHECK
    (pages >= 0 AND events_read >= 0 AND events_imported >= 0 AND events_duplicate >= 0 AND pages <= events_read AND (events_imported + events_duplicate) = events_read AND
    (cursor_created_at IS NOT NULL OR events_read = 0));

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_cursor_complete_check CHECK ((cursor_created_at IS NULL) = (cursor_event_id IS NULL));

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_cursor_event_check
    CHECK (cursor_event_id IS NULL OR char_length(btrim(cursor_event_id)) >= 1 AND char_length(btrim(cursor_event_id)) <= 200);

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_error_check CHECK (error_message IS NULL OR char_length(btrim(error_message)) >= 1 AND char_length(btrim(error_message)) <= 4000);

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_pkey PRIMARY KEY (run_id);

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_source_check CHECK (source = 'app_feedback'::text);

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_status_check CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text]));

ALTER TABLE public.evaluation_import_runs
  ADD CONSTRAINT evaluation_import_runs_time_check CHECK (finished_at IS NULL OR finished_at >= started_at);

GRANT INSERT, SELECT, UPDATE ON public.evaluation_import_runs TO service_role;

CREATE INDEX evaluation_import_runs_source_started_idx ON public.evaluation_import_runs (source, started_at DESC, run_id DESC);

CREATE POLICY evaluation_server_only ON public.evaluation_import_runs
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);