import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';
const UPDATED_AT = '2026-11-17T10:00:00.000Z';

function storedRules(overrides: Record<string, unknown> = {}) {
  return {
    allergy_codes: [],
    custom_allergies: [],
    intolerance_codes: [],
    custom_intolerances: [],
    disliked_foods: [],
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

async function loadModule() {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('SUPABASE_ANON_KEY', 'local-anon');
  Deno.env.set('SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'local-secret' }));
  return await import('./index.ts');
}

Deno.test('loads and minimizes the authorized household food-rule snapshot', async () => {
  const { loadHouseholdFoodRules } = await loadModule();
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const client = {
    rpc(name: string, params: Record<string, unknown>) {
      calls.push({ name, params });
      return Promise.resolve({
        data: {
          authorized: true,
          adults: [{
            subject_id: USER_ID,
            membership_updated_at: UPDATED_AT,
            rules: storedRules({ allergy_codes: ['peanuts'] }),
          }],
          children: [{
            subject_id: CHILD_ID,
            profile_updated_at: UPDATED_AT,
            manager_authorized: true,
            rules: storedRules({ custom_allergies: ['Hafer'], disliked_foods: ['Oliven'] }),
          }],
        },
        error: null,
      });
    },
  };

  const result = await loadHouseholdFoodRules(USER_ID, HOUSEHOLD_ID, client);

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected a complete household rule snapshot');
  assertEquals(calls, [{
    name: 'get_ai_household_food_rule_snapshot',
    params: { p_household_id: HOUSEHOLD_ID, p_requester_user_id: USER_ID },
  }]);
  assertEquals(result.foodRules.allergyCodes, ['peanuts']);
  assertEquals(result.foodRules.customAllergies, ['Hafer']);
  assertEquals(result.foodRules.dislikedFoods, ['Oliven']);
  assertMatch(result.foodRules.updatedAt ?? '', /^hmac-sha256:[0-9a-f]{64}$/);
  assertEquals(JSON.stringify(result.foodRules).includes(USER_ID), false);
  assertEquals(JSON.stringify(result.foodRules).includes(CHILD_ID), false);
});

Deno.test('maps unauthorized, incomplete, malformed, and failed snapshot reads to closed errors', async () => {
  const { loadHouseholdFoodRules } = await loadModule();
  const responses = [
    { data: { authorized: false, adults: [], children: [] }, error: null },
    {
      data: {
        authorized: true,
        adults: [{
          subject_id: USER_ID,
          membership_updated_at: UPDATED_AT,
          rules: null,
        }],
        children: [],
      },
      error: null,
    },
    { data: { unsafe: true }, error: null },
    { data: null, error: { message: 'private database detail' } },
  ];
  const client = {
    rpc() {
      return Promise.resolve(responses.shift());
    },
  };

  assertEquals(await loadHouseholdFoodRules(USER_ID, HOUSEHOLD_ID, client), {
    ok: false,
    status: 403,
    error: 'household_forbidden',
  });
  assertEquals(await loadHouseholdFoodRules(USER_ID, HOUSEHOLD_ID, client), {
    ok: false,
    status: 409,
    error: 'food_rule_snapshot_incomplete',
  });
  assertEquals(await loadHouseholdFoodRules(USER_ID, HOUSEHOLD_ID, client), {
    ok: false,
    status: 503,
    error: 'food_rule_snapshot_unavailable',
  });
  assertEquals(await loadHouseholdFoodRules(USER_ID, HOUSEHOLD_ID, client), {
    ok: false,
    status: 503,
    error: 'food_rule_snapshot_unavailable',
  });
});
