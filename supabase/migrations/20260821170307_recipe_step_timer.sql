-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

COMMENT ON TABLE public.recipe_steps IS 'Ein Zubereitungsschritt eines Rezepts, in Reihenfolge ueber position. image_path zeigt in den recipe-step-images-Bucket (13_recipe_step_storage.sql). timer_minutes ist ein optionaler, explizit gesetzter Kochmodus-Timer.';

ALTER TABLE public.recipe_steps
  ADD COLUMN timer_minutes integer;

ALTER TABLE public.recipe_steps
  ADD CONSTRAINT recipe_steps_timer_minutes_check CHECK (timer_minutes > 0);