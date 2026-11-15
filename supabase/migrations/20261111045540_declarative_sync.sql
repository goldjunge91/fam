CREATE INDEX catalog_recipe_items_product_recipe_position_idx ON public.catalog_recipe_component_items USING btree (product_id, recipe_id, "position", id);
