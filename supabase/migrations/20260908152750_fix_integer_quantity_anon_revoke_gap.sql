SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."adjust_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, timestamp WITH time zone) FROM "anon";

REVOKE ALL ON FUNCTION "public"."correct_fridge_item_quantity"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone) FROM "anon";

REVOKE ALL ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone) FROM "anon";

REVOKE ALL ON FUNCTION "public"."reverse_move_fridge_item"(uuid, uuid, uuid, uuid, uuid, uuid, bigint, uuid, uuid, timestamp WITH time zone, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."split_fridge_item_open"(uuid, uuid, uuid, uuid, bigint, bigint, timestamp WITH time zone, date, boolean, timestamp WITH time zone) FROM "anon";
