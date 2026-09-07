SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."adjust_fridge_item_quantity"(uuid, uuid, uuid, uuid, numeric, timestamp WITH time zone) FROM "anon";
