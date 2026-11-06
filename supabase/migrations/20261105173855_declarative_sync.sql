ALTER TABLE "public"."purchase_receipts"
  DROP CONSTRAINT "purchase_receipts_created_by_fkey";

ALTER TABLE "public"."receipt_assets"
  DROP CONSTRAINT "receipt_assets_created_by_fkey";

ALTER TABLE "public"."purchase_receipts"
  ALTER COLUMN "created_by" DROP NOT NULL;

ALTER TABLE "public"."receipt_assets"
  ALTER COLUMN "created_by" DROP NOT NULL;

ALTER TABLE "public"."purchase_receipts"
  ADD CONSTRAINT "purchase_receipts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."receipt_assets"
  ADD CONSTRAINT "receipt_assets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
