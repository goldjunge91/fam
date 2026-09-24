CREATE TABLE "public"."recipe_step_images" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "step_id"      uuid                     NOT NULL,
  "recipe_id"    uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "storage_path" text                     NOT NULL,
  "position"     integer                  NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"   timestamp with time zone,
  CONSTRAINT "recipe_step_images_pkey" PRIMARY KEY (id),
  CONSTRAINT "recipe_step_images_position_check" CHECK (("position" >= 0)),
  CONSTRAINT "recipe_step_images_storage_path_key" UNIQUE (storage_path)
);

ALTER TABLE "public"."recipe_step_images"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."recipe_step_images"
  ADD CONSTRAINT "recipe_step_images_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."recipe_step_images"
  ADD CONSTRAINT "recipe_step_images_recipe_id_fkey" FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE "public"."recipe_step_images"
  ADD CONSTRAINT "recipe_step_images_step_id_fkey" FOREIGN KEY (step_id) REFERENCES public.recipe_steps(id) ON DELETE CASCADE;

CREATE INDEX recipe_step_images_household_updated_idx ON public.recipe_step_images USING btree (household_id, updated_at);

CREATE INDEX recipe_step_images_recipe_position_idx ON public.recipe_step_images USING btree (recipe_id, "position");

CREATE INDEX recipe_step_images_step_position_idx ON public.recipe_step_images USING btree (step_id, "position");

CREATE TRIGGER recipe_step_images_set_updated_at
  BEFORE UPDATE ON public.recipe_step_images
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "recipe_step_images_household" ON "public"."recipe_step_images"
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.is_household_member(recipe_step_images.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(recipe_step_images.household_id) AS is_household_member));

COMMENT ON TABLE "public"."recipe_step_images" IS 'Synchronisierte Bilder je Rezeptschritt. Die Reihenfolge wird ueber position bestimmt; recipe_steps.image_path ist nur der Legacy-Fallback.';

COMMENT ON TABLE "public"."recipe_steps" IS 'Ein Zubereitungsschritt eines Rezepts, in Reihenfolge ueber position. image_path bleibt als Legacy-Einzelbild fuer bestehende Rezepte erhalten; neue Mehrfachbilder liegen in recipe_step_images. timer_minutes ist ein optionaler, explizit gesetzter Kochmodus-Timer.';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."recipe_step_images" TO "anon", "authenticated", "postgres", "service_role";
