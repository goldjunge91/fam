SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."claim_off_enrichment_cache"(text, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."claim_off_enrichment_cache"(text, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."consume_request_limit"(uuid, text, integer, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."consume_request_limit"(uuid, text, integer, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."release_ai_credit"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."release_ai_credit"(uuid) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."release_off_enrichment_cache"(text, uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."release_off_enrichment_cache"(text, uuid) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."store_off_enrichment_cache"(text, uuid, text, text[], timestamp WITH time zone, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."store_off_enrichment_cache"(text, uuid, text, text[], timestamp WITH time zone, integer) FROM "authenticated";

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ai_credit_bookings" TO "service_role";
