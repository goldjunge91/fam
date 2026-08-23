-- Gewuenschter Endzustand der Zugriffsrechte — NICHT von Hand migrieren.
-- Zentralisiert sicherheitskritische Grants; nur pg-delta erfasst sie vollstaendig.

-- Tabellenrechte ermoeglichen Zugriff; die sichtbaren Zeilen bestimmt weiterhin RLS.
grant delete, insert, select, update on public.profiles to anon, authenticated, service_role;
grant delete, insert, select, update on public.households to anon, authenticated, service_role;
grant delete, insert, select, update on public.household_members to anon, authenticated, service_role;
grant delete, insert, select, update on public.products to anon, authenticated, service_role;
grant delete, insert, select, update on public.household_invites to anon, authenticated, service_role;
grant delete, insert, select, update on public.child_profiles to anon, authenticated, service_role;
grant delete, insert, select, update on public.storage_locations to anon, authenticated, service_role;
grant delete, insert, select, update on public.stores to anon, authenticated, service_role;
grant delete, insert, select, update on public.fridge_items to anon, authenticated, service_role;
grant delete, insert, select, update on public.shopping_list_items to anon, authenticated, service_role;
grant delete, insert, select, update on public.shopping_history to anon, authenticated, service_role;
revoke all on public.shopping_category_preferences from authenticated;
grant insert, select, update on public.shopping_category_preferences to authenticated;
grant delete, insert, select, update on public.shopping_category_preferences to service_role;
revoke all on public.shopping_category_preferences from anon;
grant delete, insert, select, update on public.food_entries to anon, authenticated, service_role;
grant delete, insert, select, update on public.weight_entries to anon, authenticated, service_role;
grant delete, insert, select, update on public.user_goals to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipes to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_components to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_component_items to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_steps to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_step_ingredients to anon, authenticated, service_role;
grant delete, insert, select, update on public.meal_plans to anon, authenticated, service_role;
grant delete, insert, select, update on public.meal_plan_entries to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_templates to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_template_components to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_template_items to anon, authenticated, service_role;
grant delete, insert, select, update on public.recipe_template_steps to anon, authenticated, service_role;
grant delete, insert, select, update on public.medication_logs to anon, authenticated, service_role;
grant delete, insert, select, update on public.symptom_logs to anon, authenticated, service_role;
grant delete, insert, select, update on public.fasting_sessions to anon, authenticated, service_role;
grant delete, insert, select, update on public.glucose_entries to anon, authenticated, service_role;
grant delete, insert, select, update on public.ketone_entries to anon, authenticated, service_role;
grant delete, insert, select, update on public.exercises to anon, authenticated, service_role;
grant delete, insert, select, update on public.workout_sessions to anon, authenticated, service_role;
grant delete, insert, select, update on public.workout_sets to anon, authenticated, service_role;

-- RLS schuetzt keine Spalten. Authenticated verliert deshalb das Tabellen-UPDATE
-- und erhaelt nur erlaubte Spalten zurueck; Premium bleibt service_role vorbehalten.
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

-- Nur authenticated braucht private-USAGE fuer die RLS-Helfer.
grant usage on schema private to authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_admin(uuid) to authenticated;

-- PUBLIC erhaelt standardmaessig EXECUTE; der explizite Entzug schuetzt auch anon.
revoke execute on function private.is_household_member(uuid) from public, anon;
revoke execute on function private.is_household_admin(uuid) from public, anon;

-- Trigger-Funktionen duerfen nicht direkt aufgerufen werden.
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.guard_last_admin() from public, anon, authenticated;
revoke execute on function private.delete_orphaned_household() from public, anon, authenticated;

-- Remote kann anon EXECUTE direkt erhalten; deshalb immer PUBLIC und anon entziehen.
revoke execute on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

-- redeem_invite braucht eine authentifizierte user_id, aber keine Mitgliedschaft.
revoke execute on function public.redeem_invite(uuid) from public, anon;
grant execute on function public.redeem_invite(uuid) to authenticated;

revoke execute on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;

-- Der RLS-umgehende Profil-RPC bleibt ausschliesslich authenticated vorbehalten.
revoke execute on function public.household_member_profiles(uuid) from public, anon;
grant execute on function public.household_member_profiles(uuid) to authenticated;
