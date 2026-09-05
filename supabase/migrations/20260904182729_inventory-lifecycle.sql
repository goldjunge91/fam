SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

REVOKE ALL ON FUNCTION "public"."apply_plus_household_event"(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."apply_plus_household_event"(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."assign_ai_household"(uuid, uuid, timestamp WITH time zone, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."assign_ai_household"(uuid, uuid, timestamp WITH time zone, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."create_household"(text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."deactivate_ai_household"(uuid, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."deactivate_ai_household"(uuid, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."get_ai_credit_status"(uuid, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."get_ai_credit_status"(uuid, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."household_member_profiles"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."prepare_account_deletion"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."redeem_invite"(uuid) FROM "anon";

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "anon";

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "authenticated";

REVOKE ALL ON TABLE "public"."feedback_messages" FROM "anon";

REVOKE ALL ON TABLE "public"."feedback_tickets" FROM "anon";

REVOKE ALL ON TABLE "public"."profile_food_rules" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_ai_assignments" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_ai_assignments" FROM "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_plus_assignments" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_plus_assignments" FROM "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "authenticated";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "anon";

REVOKE ALL ON TABLE "public"."shopping_category_preferences" FROM "anon";

CREATE TABLE "public"."transactions" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "household_id"         uuid                     NOT NULL,
  "fridge_item_id"       uuid,
  "product_id"           uuid,
  "actor"                uuid,
  "type"                 text                     NOT NULL,
  "quantity"             numeric(10,3)            NOT NULL,
  "location_id"          uuid,
  "reason"               text,
  "previous_expiry_date" date,
  "notes"                text,
  "undone"               boolean                  NOT NULL DEFAULT false,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "transactions_notes_check" CHECK (((notes IS NULL) OR (length(notes) <= 500))),
  CONSTRAINT "transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "transactions_previous_expiry_only_for_open" CHECK (((previous_expiry_date IS NULL) OR (type = 'open'::text))),
  CONSTRAINT "transactions_quantity_check" CHECK ((quantity > (0)::numeric)),
  CONSTRAINT "transactions_reason_check" CHECK ((reason = ANY (ARRAY['expired'::text, 'spoiled'::text, 'other'::text]))),
  CONSTRAINT "transactions_reason_matches_waste" CHECK (((type = 'waste'::text) = (reason IS NOT NULL))),
  CONSTRAINT "transactions_type_check" CHECK ((type = ANY (ARRAY['in'::text, 'out'::text, 'waste'::text, 'open'::text])))
);

ALTER TABLE "public"."transactions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions"
  REPLICA IDENTITY FULL;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "opened_at" timestamp WITH time zone;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "vacuum_sealed" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "expiry_user_set" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_actor_fkey" FOREIGN KEY (actor) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_fridge_item_id_fkey" FOREIGN KEY (fridge_item_id) REFERENCES public.fridge_items(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.storage_locations(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX transactions_fridge_item_id_idx ON public.transactions USING btree (fridge_item_id);

CREATE INDEX transactions_household_created_idx ON public.transactions USING btree (household_id, created_at);

CREATE INDEX transactions_household_id_idx ON public.transactions USING btree (household_id);

CREATE POLICY "transactions_insert_member" ON "public"."transactions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.is_household_member(transactions.household_id) AS is_household_member));

CREATE POLICY "transactions_select_member" ON "public"."transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(transactions.household_id) AS is_household_member));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."transactions";

COMMENT ON TABLE "public"."transactions" IS 'Ledger jeder Bestandsbewegung. Transaktionen werden angehängt, nie editiert.';

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "service_role";

GRANT INSERT, SELECT ON TABLE "public"."ai_credit_bookings" TO "service_role";

REVOKE ALL ON TABLE "public"."feedback_messages" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."feedback_messages" TO "authenticated";

REVOKE ALL ON TABLE "public"."feedback_tickets" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."feedback_tickets" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_food_rules" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."profile_food_rules" TO "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "service_role";

GRANT INSERT, SELECT ON TABLE "public"."revenuecat_processed_events" TO "service_role";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "authenticated";

GRANT INSERT ON TABLE "public"."shopping_category_feedback_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "service_role";

GRANT SELECT ON TABLE "public"."shopping_category_feedback_events" TO "service_role";

REVOKE ALL ON TABLE "public"."shopping_category_preferences" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."shopping_category_preferences" TO "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."transactions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "postgres";

GRANT INSERT, SELECT ON TABLE "public"."transactions" TO "service_role";
