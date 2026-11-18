const ALLERGY_CODES = new Set([
  'gluten-containing-cereals',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree-nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphur-dioxide-sulphites',
  'lupin',
  'molluscs',
]);

const INTOLERANCE_CODES = new Set([
  'lactose',
  'fructose-malabsorption',
  'sorbitol-malabsorption',
  'celiac-gluten',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNAPSHOT_UNAVAILABLE = {
  ok: false,
  status: 503,
  error: 'food_rule_snapshot_unavailable',
} as const;
const SNAPSHOT_INCOMPLETE = {
  ok: false,
  status: 409,
  error: 'food_rule_snapshot_incomplete',
} as const;
const SNAPSHOT_FORBIDDEN = {
  ok: false,
  status: 403,
  error: 'household_forbidden',
} as const;

type JsonRecord = Record<string, unknown>;

type StoredFoodRules = {
  allergy_codes: string[];
  custom_allergies: string[];
  intolerance_codes: string[];
  custom_intolerances: string[];
  disliked_foods: string[];
  updated_at: string;
};

type AdultRuleSubject = {
  subject_id: string;
  membership_updated_at: string;
  rules: StoredFoodRules | null;
};

type ChildRuleSubject = {
  subject_id: string;
  profile_updated_at: string;
  manager_authorized: boolean;
  rules: StoredFoodRules | null;
};

type RawHouseholdFoodRuleSnapshot = {
  authorized: boolean;
  adults: AdultRuleSubject[];
  children: ChildRuleSubject[];
};

export type HouseholdFoodRuleSnapshot = {
  allergyCodes: string[];
  customAllergies: string[];
  intoleranceCodes: string[];
  customIntolerances: string[];
  dislikedFoods: string[];
  version: string;
};

export type HouseholdFoodRuleSnapshotResult =
  | { ok: true; snapshot: HouseholdFoodRuleSnapshot }
  | typeof SNAPSHOT_UNAVAILABLE
  | typeof SNAPSHOT_INCOMPLETE
  | typeof SNAPSHOT_FORBIDDEN;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && keys.every((key, index) => actual[index] === key);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isStringArray(
  value: unknown,
  options: { maximum: number; allowed?: ReadonlySet<string> },
): value is string[] {
  return Array.isArray(value) && value.length <= options.maximum &&
    value.every((item) =>
      typeof item === 'string' && item.trim().length > 0 && item.length <= 200 &&
      (options.allowed?.has(item) ?? true)
    );
}

function isStoredFoodRules(value: unknown): value is StoredFoodRules {
  if (!isRecord(value)) return false;
  const keys = [
    'allergy_codes',
    'custom_allergies',
    'custom_intolerances',
    'disliked_foods',
    'intolerance_codes',
    'updated_at',
  ];
  return hasExactKeys(value, keys) &&
    isStringArray(value.allergy_codes, { maximum: 14, allowed: ALLERGY_CODES }) &&
    isStringArray(value.custom_allergies, { maximum: 64 }) &&
    isStringArray(value.intolerance_codes, { maximum: 4, allowed: INTOLERANCE_CODES }) &&
    isStringArray(value.custom_intolerances, { maximum: 64 }) &&
    isStringArray(value.disliked_foods, { maximum: 64 }) &&
    isTimestamp(value.updated_at);
}

function isAdultRuleSubject(value: unknown): value is AdultRuleSubject {
  if (!isRecord(value)) return false;
  return hasExactKeys(value, ['membership_updated_at', 'rules', 'subject_id']) &&
    typeof value.subject_id === 'string' && UUID_PATTERN.test(value.subject_id) &&
    isTimestamp(value.membership_updated_at) &&
    (value.rules === null || isStoredFoodRules(value.rules));
}

function isChildRuleSubject(value: unknown): value is ChildRuleSubject {
  if (!isRecord(value)) return false;
  return hasExactKeys(value, [
    'manager_authorized',
    'profile_updated_at',
    'rules',
    'subject_id',
  ]) &&
    typeof value.subject_id === 'string' && UUID_PATTERN.test(value.subject_id) &&
    isTimestamp(value.profile_updated_at) &&
    typeof value.manager_authorized === 'boolean' &&
    (value.rules === null || isStoredFoodRules(value.rules));
}

function parseRawSnapshot(value: unknown): RawHouseholdFoodRuleSnapshot | null {
  if (
    !isRecord(value) || !hasExactKeys(value, ['adults', 'authorized', 'children']) ||
    typeof value.authorized !== 'boolean' ||
    !Array.isArray(value.adults) ||
    !Array.isArray(value.children)
  ) return null;
  if (!value.authorized) {
    return value.adults.length === 0 && value.children.length === 0
      ? { authorized: false, adults: [], children: [] }
      : null;
  }
  if (
    value.adults.length === 0 ||
    !value.adults.every(isAdultRuleSubject) ||
    !value.children.every(isChildRuleSubject)
  ) return null;

  const adultIds = new Set(value.adults.map((subject) => subject.subject_id));
  const childIds = new Set(value.children.map((subject) => subject.subject_id));
  if (adultIds.size !== value.adults.length || childIds.size !== value.children.length) return null;

  return { authorized: true, adults: value.adults, children: value.children };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

async function hmacSha256(key: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Removes person identifiers after deriving an opaque version for later revalidation. */
export async function projectHouseholdFoodRuleSnapshot(
  householdId: string,
  versionKey: string,
  value: unknown,
): Promise<HouseholdFoodRuleSnapshotResult> {
  if (!UUID_PATTERN.test(householdId) || versionKey.length === 0) return SNAPSHOT_UNAVAILABLE;
  const raw = parseRawSnapshot(value);
  if (!raw) return SNAPSHOT_UNAVAILABLE;
  if (!raw.authorized) return SNAPSHOT_FORBIDDEN;
  if (
    raw.adults.some((subject) => subject.rules === null) ||
    raw.children.some((subject) => subject.rules === null || !subject.manager_authorized)
  ) return SNAPSHOT_INCOMPLETE;

  const adults = [...raw.adults].sort((left, right) =>
    left.subject_id.localeCompare(right.subject_id)
  );
  const children = [...raw.children].sort((left, right) =>
    left.subject_id.localeCompare(right.subject_id)
  );
  const ruleSets = [
    ...adults.map((subject) => subject.rules),
    ...children.map((subject) => subject.rules),
  ].filter((rules): rules is StoredFoodRules => rules !== null);
  const versionPayload = `fam:household-food-rule-snapshot:v1:${
    JSON.stringify({
      householdId,
      adults,
      children,
    })
  }`;

  return {
    ok: true,
    snapshot: {
      allergyCodes: sortedUnique(ruleSets.flatMap((rules) => rules.allergy_codes)),
      customAllergies: sortedUnique(ruleSets.flatMap((rules) => rules.custom_allergies)),
      intoleranceCodes: sortedUnique(ruleSets.flatMap((rules) => rules.intolerance_codes)),
      customIntolerances: sortedUnique(ruleSets.flatMap((rules) => rules.custom_intolerances)),
      dislikedFoods: sortedUnique(ruleSets.flatMap((rules) => rules.disliked_foods)),
      version: `hmac-sha256:${await hmacSha256(versionKey, versionPayload)}`,
    },
  };
}
