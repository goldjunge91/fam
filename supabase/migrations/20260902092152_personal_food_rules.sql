-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.profile_food_rules (
  user_id             uuid                     NOT NULL,
  allergy_codes       text[]                   DEFAULT '{}'::text[] NOT NULL,
  custom_allergies    text[]                   DEFAULT '{}'::text[] NOT NULL,
  intolerance_codes   text[]                   DEFAULT '{}'::text[] NOT NULL,
  custom_intolerances text[]                   DEFAULT '{}'::text[] NOT NULL,
  disliked_foods      text[]                   DEFAULT '{}'::text[] NOT NULL,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profile_food_rules IS 'Private, accountweite Allergien, Unvertraeglichkeiten und Lebensmittelabneigungen.';

ALTER TABLE public.profile_food_rules
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profile_food_rules
  ADD CONSTRAINT profile_food_rules_allergy_codes_allowed
    CHECK
    (allergy_codes <@ ARRAY['gluten-containing-cereals'::text, 'crustaceans'::text, 'eggs'::text, 'fish'::text, 'peanuts'::text, 'soybeans'::text, 'milk'::text, 'tree-nuts'::text,
    'celery'::text, 'mustard'::text, 'sesame'::text, 'sulphur-dioxide-sulphites'::text, 'lupin'::text, 'molluscs'::text] AND cardinality(allergy_codes) <= 14);

ALTER TABLE public.profile_food_rules
  ADD CONSTRAINT profile_food_rules_custom_counts CHECK (cardinality(custom_allergies) <= 64 AND cardinality(custom_intolerances) <= 64 AND cardinality(disliked_foods) <= 64);

ALTER TABLE public.profile_food_rules
  ADD CONSTRAINT profile_food_rules_intolerance_codes_allowed
    CHECK
    (intolerance_codes <@ ARRAY['lactose'::text, 'fructose-malabsorption'::text, 'sorbitol-malabsorption'::text, 'celiac-gluten'::text] AND cardinality(intolerance_codes) <= 4);

ALTER TABLE public.profile_food_rules
  ADD CONSTRAINT profile_food_rules_pkey PRIMARY KEY (user_id);

ALTER TABLE public.profile_food_rules
  ADD CONSTRAINT profile_food_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT INSERT, SELECT, UPDATE ON public.profile_food_rules TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.profile_food_rules TO service_role;

CREATE TRIGGER profile_food_rules_set_updated_at
  BEFORE UPDATE ON public.profile_food_rules
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY profile_food_rules_insert_own ON public.profile_food_rules
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY profile_food_rules_select_own ON public.profile_food_rules
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY profile_food_rules_update_own ON public.profile_food_rules
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));