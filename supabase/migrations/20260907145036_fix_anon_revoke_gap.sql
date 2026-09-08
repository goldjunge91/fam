SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."correct_fridge_item_quantity"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone) FROM "anon";

REVOKE ALL ON FUNCTION "public"."reverse_inventory_quantity_transaction"(uuid, uuid, uuid, uuid, timestamp WITH time zone, text) FROM "anon";
