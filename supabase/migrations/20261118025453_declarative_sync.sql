SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_ai_household_food_rule_snapshot (
  p_household_id      uuid,
  p_requester_user_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  with access as (
    select exists (
      select 1
      from public.household_members member
      where member.household_id = p_household_id
        and member.user_id = p_requester_user_id
    ) as authorized
  )
  select jsonb_build_object(
    'authorized', access.authorized,
    'adults', case when access.authorized then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject_id', member.user_id,
          'membership_updated_at', member.updated_at,
          'rules', case when rules.user_id is null then null else jsonb_build_object(
            'allergy_codes', rules.allergy_codes,
            'custom_allergies', rules.custom_allergies,
            'intolerance_codes', rules.intolerance_codes,
            'custom_intolerances', rules.custom_intolerances,
            'disliked_foods', rules.disliked_foods,
            'updated_at', rules.updated_at
          ) end
        )
        order by member.user_id
      )
      from public.household_members member
      left join public.profile_food_rules rules on rules.user_id = member.user_id
      where member.household_id = p_household_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'children', case when access.authorized then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject_id', child.id,
          'profile_updated_at', child.updated_at,
          'manager_authorized', exists (
            select 1
            from public.household_members manager
            where manager.household_id = child.household_id
              and manager.user_id = child.managed_by
          ),
          'rules', case when rules.child_profile_id is null then null else jsonb_build_object(
            'allergy_codes', rules.allergy_codes,
            'custom_allergies', rules.custom_allergies,
            'intolerance_codes', rules.intolerance_codes,
            'custom_intolerances', rules.custom_intolerances,
            'disliked_foods', rules.disliked_foods,
            'updated_at', rules.updated_at
          ) end
        )
        order by child.id
      )
      from public.child_profiles child
      left join public.child_profile_food_rules rules
        on rules.child_profile_id = child.id
      where child.household_id = p_household_id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from access;
$function$;

REVOKE ALL ON FUNCTION "public"."get_ai_household_food_rule_snapshot"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

COMMENT ON FUNCTION "public"."get_ai_household_food_rule_snapshot"(uuid, uuid) IS 'Service-only Roh-Snapshot aller aktuellen Erwachsenen- und Kinderregeln eines Haushalts; prueft die anfragende Mitgliedschaft und enthaelt keine Anzeigenamen.';

REVOKE ALL ON FUNCTION "public"."get_ai_household_food_rule_snapshot"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_ai_household_food_rule_snapshot"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_ai_household_food_rule_snapshot"(uuid, uuid) TO "service_role";
