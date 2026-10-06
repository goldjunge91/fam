ALTER TABLE "public"."purchase_receipt_items"
  REPLICA IDENTITY FULL;

ALTER TABLE "public"."purchase_receipts"
  REPLICA IDENTITY FULL;

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."purchase_receipt_items";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."purchase_receipts";
