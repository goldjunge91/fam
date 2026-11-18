import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1';

import { projectHouseholdFoodRuleSnapshot } from './household-food-rule-snapshot.ts';

const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ALICE_ID = '11111111-1111-4111-8111-111111111111';
const BOB_ID = '22222222-2222-4222-8222-222222222222';
const CHILD_ID = '33333333-3333-4333-8333-333333333333';
const UPDATED_AT = '2026-11-17T10:00:00.000Z';
const VERSION_KEY = 'server-only-snapshot-key-for-tests';

type RuleOverrides = Partial<{
  allergy_codes: string[];
  custom_allergies: string[];
  intolerance_codes: string[];
  custom_intolerances: string[];
  disliked_foods: string[];
  updated_at: string;
}>;

function rules(overrides: RuleOverrides = {}) {
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

function rawSnapshot() {
  return {
    authorized: true,
    adults: [
      {
        subject_id: ALICE_ID,
        membership_updated_at: '2026-11-17T08:00:00.000Z',
        rules: rules({
          allergy_codes: ['peanuts'],
          custom_allergies: ['Johannisbrot'],
          disliked_foods: ['Pilze'],
        }),
      },
      {
        subject_id: BOB_ID,
        membership_updated_at: '2026-11-17T09:00:00.000Z',
        rules: rules({
          allergy_codes: ['milk', 'peanuts'],
          intolerance_codes: ['lactose'],
        }),
      },
    ],
    children: [
      {
        subject_id: CHILD_ID,
        profile_updated_at: '2026-11-17T09:30:00.000Z',
        manager_authorized: true,
        rules: rules({
          custom_allergies: ['Hafer'],
          custom_intolerances: ['Histamin'],
          disliked_foods: ['Oliven'],
        }),
      },
    ],
  };
}

Deno.test('projects all adult and child rules without retaining person identifiers', async () => {
  const result = await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, rawSnapshot());

  assertEquals(result.ok, true);
  if (!result.ok) throw new Error('expected a complete snapshot');
  assertEquals(result.snapshot.allergyCodes, ['milk', 'peanuts']);
  assertEquals(result.snapshot.customAllergies, ['Hafer', 'Johannisbrot']);
  assertEquals(result.snapshot.intoleranceCodes, ['lactose']);
  assertEquals(result.snapshot.customIntolerances, ['Histamin']);
  assertEquals(result.snapshot.dislikedFoods, ['Oliven', 'Pilze']);
  assertMatch(result.snapshot.version, /^hmac-sha256:[0-9a-f]{64}$/);
  assertEquals(JSON.stringify(result.snapshot).includes(ALICE_ID), false);
  assertEquals(JSON.stringify(result.snapshot).includes(BOB_ID), false);
  assertEquals(JSON.stringify(result.snapshot).includes(CHILD_ID), false);
});

Deno.test('keeps the snapshot version stable when database row order changes', async () => {
  const raw = rawSnapshot();
  const reordered = {
    authorized: true,
    adults: [...raw.adults].reverse(),
    children: [...raw.children].reverse(),
  };

  const first = await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, raw);
  const second = await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, reordered);

  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  if (!first.ok || !second.ok) throw new Error('expected complete snapshots');
  assertEquals(first.snapshot.version, second.snapshot.version);
});

Deno.test('fails closed when any adult or child rule row is missing', async () => {
  const adultSource = rawSnapshot();
  const missingAdult = {
    ...adultSource,
    adults: adultSource.adults.map((subject, index) =>
      index === 1 ? { ...subject, rules: null } : subject
    ),
  };
  const childSource = rawSnapshot();
  const missingChild = {
    ...childSource,
    children: childSource.children.map((subject) => ({ ...subject, rules: null })),
  };

  assertEquals(await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, missingAdult), {
    ok: false,
    status: 409,
    error: 'food_rule_snapshot_incomplete',
  });
  assertEquals(await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, missingChild), {
    ok: false,
    status: 409,
    error: 'food_rule_snapshot_incomplete',
  });
});

Deno.test('fails closed when a child has no current household manager relationship', async () => {
  const raw = rawSnapshot();
  raw.children[0] = { ...raw.children[0], manager_authorized: false };

  assertEquals(await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, raw), {
    ok: false,
    status: 409,
    error: 'food_rule_snapshot_incomplete',
  });
});

Deno.test('rejects a snapshot when the requester is no longer a household member', async () => {
  assertEquals(
    await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, {
      authorized: false,
      adults: [],
      children: [],
    }),
    { ok: false, status: 403, error: 'household_forbidden' },
  );
});

Deno.test('rejects malformed, duplicate, or empty household snapshots', async () => {
  const duplicate = rawSnapshot();
  duplicate.adults.push({ ...duplicate.adults[0] });

  for (const value of [null, {}, { authorized: true, adults: [], children: [] }, duplicate]) {
    assertEquals(await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, value), {
      ok: false,
      status: 503,
      error: 'food_rule_snapshot_unavailable',
    });
  }
});

Deno.test('changes the snapshot version after rules, membership, or child profile changes', async () => {
  const base = await projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, rawSnapshot());
  const changedRules = rawSnapshot();
  changedRules.adults[0] = {
    ...changedRules.adults[0],
    rules: rules({ allergy_codes: ['eggs'], updated_at: '2026-11-17T11:00:00.000Z' }),
  };
  const removedMember = rawSnapshot();
  removedMember.adults = removedMember.adults.slice(0, 1);
  const changedChild = rawSnapshot();
  changedChild.children[0] = {
    ...changedChild.children[0],
    profile_updated_at: '2026-11-17T12:00:00.000Z',
  };

  const variants = await Promise.all(
    [changedRules, removedMember, changedChild].map((value) =>
      projectHouseholdFoodRuleSnapshot(HOUSEHOLD_ID, VERSION_KEY, value)
    ),
  );
  assertEquals(base.ok, true);
  if (!base.ok) throw new Error('expected complete base snapshot');
  for (const variant of variants) {
    assertEquals(variant.ok, true);
    if (!variant.ok) throw new Error('expected complete variant snapshot');
    assertNotEquals(variant.snapshot.version, base.snapshot.version);
  }
});

Deno.test('binds opaque versions to a server-only key', async () => {
  const first = await projectHouseholdFoodRuleSnapshot(
    HOUSEHOLD_ID,
    VERSION_KEY,
    rawSnapshot(),
  );
  const second = await projectHouseholdFoodRuleSnapshot(
    HOUSEHOLD_ID,
    'a-different-server-only-snapshot-key',
    rawSnapshot(),
  );

  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  if (!first.ok || !second.ok) throw new Error('expected complete snapshots');
  assertNotEquals(first.snapshot.version, second.snapshot.version);
});
