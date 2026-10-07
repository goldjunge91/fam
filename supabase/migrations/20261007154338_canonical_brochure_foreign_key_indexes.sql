CREATE INDEX brochure_availability_canonical_brochure_id_idx ON public.brochure_availability USING btree (canonical_brochure_id);

CREATE INDEX canonical_brochures_store_id_idx ON public.canonical_brochures USING btree (store_id);

CREATE INDEX favorite_brochure_stores_store_id_idx ON public.favorite_brochure_stores USING btree (store_id);
