SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."move_fridge_item"(uuid, uuid, uuid, uuid, uuid, numeric, uuid, uuid, timestamp WITH time zone) FROM "anon";
