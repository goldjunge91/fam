ALTER TABLE "public"."catalog_recipe_component_items"
  ADD COLUMN "optional" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."catalog_recipe_component_items"
  ADD COLUMN "note" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "source_url" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "source_page_url" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "source_name" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "license" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "attribution_required" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "attribution_text" text;

ALTER TABLE "public"."catalog_recipe_images"
  ADD COLUMN "verified_match" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "prep_time_minutes" integer;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "storage_instructions" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "reheating_instructions" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "cheap_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "substitutions" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "crispiness_level" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "air_fryer_time_minutes" integer;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "air_fryer_temperature_f" integer;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "variant_group" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "variant_type" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "dorm_friendly" boolean;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "meal_prep_friendly" boolean;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "why_cheap" text;

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "healthier_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "batch_prep_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."catalog_recipes"
  ADD COLUMN "optional_add_ins" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."recipe_component_items"
  ADD COLUMN "optional" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."recipe_component_items"
  ADD COLUMN "note" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "prep_time_minutes" integer;

ALTER TABLE "public"."recipes"
  ADD COLUMN "storage_instructions" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "reheating_instructions" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "cheap_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."recipes"
  ADD COLUMN "substitutions" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."recipes"
  ADD COLUMN "crispiness_level" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "air_fryer_time_minutes" integer;

ALTER TABLE "public"."recipes"
  ADD COLUMN "air_fryer_temperature_f" integer;

ALTER TABLE "public"."recipes"
  ADD COLUMN "variant_group" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "variant_type" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "dorm_friendly" boolean;

ALTER TABLE "public"."recipes"
  ADD COLUMN "meal_prep_friendly" boolean;

ALTER TABLE "public"."recipes"
  ADD COLUMN "why_cheap" text;

ALTER TABLE "public"."recipes"
  ADD COLUMN "healthier_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."recipes"
  ADD COLUMN "batch_prep_tips" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."recipes"
  ADD COLUMN "optional_add_ins" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."catalog_recipe_images"
  ALTER COLUMN "storage_path" DROP NOT NULL;

ALTER TABLE "public"."catalog_recipe_images"
  ADD CONSTRAINT "catalog_recipe_images_source_check" CHECK (((storage_path IS NOT NULL) OR (source_url IS NOT NULL)));

ALTER TABLE "public"."catalog_recipes"
  ADD CONSTRAINT "catalog_recipes_air_fryer_temperature_f_check" CHECK ((air_fryer_temperature_f > 0));

ALTER TABLE "public"."catalog_recipes"
  ADD CONSTRAINT "catalog_recipes_air_fryer_time_minutes_check" CHECK ((air_fryer_time_minutes > 0));

ALTER TABLE "public"."catalog_recipes"
  ADD CONSTRAINT "catalog_recipes_prep_time_minutes_check" CHECK ((prep_time_minutes > 0));

ALTER TABLE "public"."catalog_recipes"
  ADD CONSTRAINT "catalog_recipes_substitutions_check" CHECK ((jsonb_typeof(substitutions) = 'array'::text));

ALTER TABLE "public"."recipes"
  ADD CONSTRAINT "recipes_air_fryer_temperature_f_check" CHECK ((air_fryer_temperature_f > 0));

ALTER TABLE "public"."recipes"
  ADD CONSTRAINT "recipes_air_fryer_time_minutes_check" CHECK ((air_fryer_time_minutes > 0));

ALTER TABLE "public"."recipes"
  ADD CONSTRAINT "recipes_prep_time_minutes_check" CHECK ((prep_time_minutes > 0));

ALTER TABLE "public"."recipes"
  ADD CONSTRAINT "recipes_substitutions_check" CHECK ((jsonb_typeof(substitutions) = 'array'::text));
