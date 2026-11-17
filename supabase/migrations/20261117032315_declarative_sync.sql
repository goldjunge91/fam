CREATE TABLE "public"."account_deletion_requests" (
  "user_id"             uuid                     NOT NULL,
  "posthog_person_ids"  text[]                   NOT NULL DEFAULT '{}'::text[],
  "delete_requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "delete_accepted_at"  timestamp with time zone,
  "delete_verified_at"  timestamp with time zone,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "account_deletion_requests_person_ids_limit" CHECK (((cardinality(posthog_person_ids) >= 1) AND (cardinality(posthog_person_ids) <= 1000))),
  CONSTRAINT "account_deletion_requests_person_ids_no_null" CHECK ((array_position(posthog_person_ids, NULL::text) IS NULL)),
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "account_deletion_requests_verified_after_acceptance" CHECK (((delete_verified_at IS NULL) OR (delete_accepted_at IS NOT NULL)))
);

ALTER TABLE "public"."account_deletion_requests"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."account_deletion_requests" FROM "anon", "authenticated";

ALTER TABLE "public"."account_deletion_requests"
  ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TRIGGER account_deletion_requests_set_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "account_deletion_requests_service_role_all" ON "public"."account_deletion_requests"
  FOR ALL
  TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."account_deletion_requests" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."account_deletion_requests" TO "service_role";
