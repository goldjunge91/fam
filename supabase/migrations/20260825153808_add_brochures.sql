-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.brochure_dumps (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  zip_code     text                     NOT NULL,
  payload_json jsonb                    NOT NULL,
  valid_from   timestamp with time zone NOT NULL,
  valid_until  timestamp with time zone NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.brochure_dumps
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.brochure_dumps
  ADD CONSTRAINT brochure_dumps_pkey PRIMARY KEY (id);

CREATE INDEX brochure_dumps_zip_code_idx ON public.brochure_dumps (zip_code, valid_until);

CREATE POLICY brochure_dumps_select ON public.brochure_dumps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.brochure_stores (
  id         text                     NOT NULL,
  name       text                     NOT NULL,
  logo_url   text,
  active     boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.brochure_stores
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.brochure_stores
  ADD CONSTRAINT brochure_stores_pkey PRIMARY KEY (id);

CREATE POLICY brochure_stores_select ON public.brochure_stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.favorite_brochure_stores (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  store_id   text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

ALTER TABLE public.favorite_brochure_stores
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favorite_brochure_stores
  ADD CONSTRAINT favorite_brochure_stores_pkey PRIMARY KEY (id);

ALTER TABLE public.favorite_brochure_stores
  ADD CONSTRAINT favorite_brochure_stores_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.brochure_stores(id) ON DELETE CASCADE;

ALTER TABLE public.favorite_brochure_stores
  ADD CONSTRAINT favorite_brochure_stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.favorite_brochure_stores
  ADD CONSTRAINT favorite_brochure_stores_user_id_store_id_key UNIQUE (user_id, store_id);

CREATE TRIGGER set_updated_at_favorite_brochure_stores
  BEFORE UPDATE ON public.favorite_brochure_stores
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY favorite_brochure_stores_all ON public.favorite_brochure_stores
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));