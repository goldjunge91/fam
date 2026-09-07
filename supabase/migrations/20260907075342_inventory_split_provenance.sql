ALTER TABLE "public"."transactions"
  ADD COLUMN "origin_item_id" uuid;

ALTER TABLE "public"."transactions"
  ADD COLUMN "origin_quantity" numeric(10,3);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_origin_item_id_fkey" FOREIGN KEY (origin_item_id) REFERENCES public.fridge_items(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_origin_quantity_check" CHECK ((origin_quantity > (0)::numeric));

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_split_origin_complete" CHECK (((origin_item_id IS NULL) = (origin_quantity IS NULL)));

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_split_origin_only_for_open" CHECK (((origin_item_id IS NULL) OR (type = 'open'::text)));

COMMENT ON COLUMN "public"."transactions"."origin_item_id" IS 'Unveraenderliche Ursprungszeile eines gesplitteten Open-Lots.';

COMMENT ON COLUMN "public"."transactions"."origin_quantity" IS 'Menge der Ursprungszeile vor dem Split, fuer einen sicheren Undo.';
