ALTER TABLE "public"."profiles"
  ADD COLUMN "weight_kg" numeric(5,2);

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_weight_kg_check" CHECK (((weight_kg > (0)::numeric) AND (weight_kg < (700)::numeric)));
