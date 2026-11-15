CREATE TABLE "public"."ai_usage_events" (
  "request_id"          uuid                     NOT NULL,
  "provider_call_index" smallint                 NOT NULL,
  "user_id"             uuid                     NOT NULL,
  "subscriber_user_id"  uuid,
  "household_id"        uuid,
  "provider"            text                     NOT NULL,
  "model"               text                     NOT NULL,
  "skill"               text                     NOT NULL,
  "is_test"             boolean                  NOT NULL DEFAULT false,
  "prompt_tokens"       bigint,
  "completion_tokens"   bigint,
  "total_tokens"        bigint,
  "provider_cost_usd"   numeric(20,12),
  "cost_source"         text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ai_usage_events_completion_tokens_check" CHECK ((completion_tokens >= 0)),
  CONSTRAINT "ai_usage_events_cost_source_check" CHECK ((cost_source = 'provider_reported'::text)),
  CONSTRAINT "ai_usage_events_cost_source_matches_cost" CHECK ((((provider_cost_usd IS NULL) AND (cost_source IS NULL)) OR ((provider_cost_usd IS NOT NULL) AND (cost_source IS
    NOT NULL)))),
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY (request_id, provider_call_index),
  CONSTRAINT "ai_usage_events_prompt_tokens_check" CHECK ((prompt_tokens >= 0)),
  CONSTRAINT "ai_usage_events_provider_call_index_check" CHECK ((provider_call_index >= 0)),
  CONSTRAINT "ai_usage_events_provider_check" CHECK ((provider = ANY (ARRAY['openrouter'::text, 'groq'::text]))),
  CONSTRAINT "ai_usage_events_provider_cost_usd_check" CHECK ((provider_cost_usd >= (0)::numeric)),
  CONSTRAINT "ai_usage_events_skill_check"
    CHECK ((skill = ANY (ARRAY['fam-assistant'::text, 'fam-cook-from-inventory'::text, 'fam-inventory-capture'::text, 'fam-recipe-import'::text, 'fam-ai-model-test'::text]))),
  CONSTRAINT "ai_usage_events_total_tokens_check" CHECK ((total_tokens >= 0))
);

ALTER TABLE "public"."ai_usage_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."ai_usage_events" FROM "anon", "authenticated";

ALTER TABLE "public"."ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE SET NULL;

ALTER TABLE "public"."ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_subscriber_user_id_fkey" FOREIGN KEY (subscriber_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX ai_usage_events_created_at_idx ON public.ai_usage_events USING btree (created_at DESC);

CREATE INDEX ai_usage_events_user_created_idx ON public.ai_usage_events USING btree (user_id, created_at DESC);

CREATE POLICY "ai_usage_events_service_role_all" ON "public"."ai_usage_events"
  FOR ALL
  TO "service_role"
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE "public"."ai_usage_events" IS 'Append-only provider token and reported-cost data, readable only by the server-side AI usage administrator.';

REVOKE ALL ON TABLE "public"."ai_usage_events" FROM "service_role";

GRANT INSERT, SELECT ON TABLE "public"."ai_usage_events" TO "service_role";
