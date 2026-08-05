-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.products (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  barcode           text,
  name              text                     NOT NULL,
  brand             text,
  kcal_per_100      numeric(7,2),
  protein_g_per_100 numeric(6,2),
  carbs_g_per_100   numeric(6,2),
  fat_g_per_100     numeric(6,2),
  fiber_g_per_100   numeric(6,2),
  sugar_g_per_100   numeric(6,2),
  salt_g_per_100    numeric(6,2),
  serving_size_g    numeric(7,2),
  source            text                     DEFAULT 'manual'::text NOT NULL,
  created_by        uuid,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.products IS 'Lebensmittel-Stammdaten, global lesbar. Nur selbst angelegte Produkte sind aenderbar.';

ALTER TABLE public.products
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products
  ADD CONSTRAINT products_barcode_key UNIQUE (barcode);

ALTER TABLE public.products
  ADD CONSTRAINT products_carbs_g_per_100_check CHECK (carbs_g_per_100 >= 0::numeric AND carbs_g_per_100 <= 100::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_fat_g_per_100_check CHECK (fat_g_per_100 >= 0::numeric AND fat_g_per_100 <= 100::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_fiber_g_per_100_check CHECK (fiber_g_per_100 >= 0::numeric AND fiber_g_per_100 <= 100::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_kcal_per_100_check CHECK (kcal_per_100 >= 0::numeric AND kcal_per_100 <= 900::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 200);

ALTER TABLE public.products
  ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE public.products
  ADD CONSTRAINT products_protein_g_per_100_check CHECK (protein_g_per_100 >= 0::numeric AND protein_g_per_100 <= 100::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_salt_g_per_100_check CHECK (salt_g_per_100 >= 0::numeric AND salt_g_per_100 <= 100::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_serving_size_g_check CHECK (serving_size_g > 0::numeric);

ALTER TABLE public.products
  ADD CONSTRAINT products_source_check CHECK (source = ANY (ARRAY['off'::text, 'manual'::text]));

ALTER TABLE public.products
  ADD CONSTRAINT products_sugar_g_per_100_check CHECK (sugar_g_per_100 >= 0::numeric AND sugar_g_per_100 <= 100::numeric);

GRANT ALL ON public.products TO anon;

GRANT ALL ON public.products TO authenticated;

GRANT ALL ON public.products TO service_role;

CREATE INDEX products_name_fts_idx ON public.products USING gin (to_tsvector('german'::regconfig, name));

CREATE INDEX products_created_by_idx ON public.products (created_by);

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY products_insert_own ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));

CREATE POLICY products_select_all ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY products_update_own_manual ON public.products
  FOR UPDATE
  TO authenticated
  USING (((( SELECT auth.uid() AS uid) = created_by) AND (source = 'manual'::text)))
  WITH CHECK (((( SELECT auth.uid() AS uid) = created_by) AND (source = 'manual'::text)));