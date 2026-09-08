SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."merge_undo_fridge_item_open"(uuid, uuid, uuid, timestamp WITH time zone, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, numeric, numeric, timestamp WITH time zone, date, boolean, timestamp WITH time zone) FROM "anon";
