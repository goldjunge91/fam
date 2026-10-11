import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { buildUserDataExport } from './data-export';

type QueryResult = { data: unknown; error: Error | null };
type TableName =
  | 'profiles'
  | 'child_profiles'
  | 'household_members'
  | 'user_goals'
  | 'food_entries'
  | 'weight_entries';

let mockResults: Record<TableName, QueryResult>;
let mockPages: Record<'user_goals' | 'food_entries' | 'weight_entries', QueryResult[]>;
let mockRanges: { table: string; from: number; to: number }[];

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

function createSupabaseMock() {
  return {
    from(table: TableName) {
      return {
        select() {
          return {
            eq() {
              if (table === 'profiles') {
                return { maybeSingle: async () => mockResults.profiles };
              }
              if (table === 'child_profiles' || table === 'household_members') {
                return Promise.resolve(mockResults[table]);
              }
              return {
                order() {
                  return {
                    async range(from: number, to: number) {
                      mockRanges.push({ table, from, to });
                      const pageIndex = from === 0 ? 0 : 1;
                      return mockPages[table][pageIndex] ?? { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function configureSupabaseMock(
  overrides: Partial<Record<TableName, QueryResult>> = {},
  pages: Partial<Record<'user_goals' | 'food_entries' | 'weight_entries', QueryResult[]>> = {},
) {
  mockResults = {
    profiles: { data: { id: 'user-1' }, error: null },
    child_profiles: { data: [{ id: 'child-1' }], error: null },
    household_members: { data: [{ id: 'membership-1' }], error: null },
    user_goals: { data: [], error: null },
    food_entries: { data: [], error: null },
    weight_entries: { data: [], error: null },
    ...overrides,
  };
  mockPages = {
    user_goals: [pages.user_goals?.[0] ?? mockResults.user_goals],
    food_entries: [pages.food_entries?.[0] ?? mockResults.food_entries],
    weight_entries: [pages.weight_entries?.[0] ?? mockResults.weight_entries],
  };
  for (const table of ['user_goals', 'food_entries', 'weight_entries'] as const) {
    const extraPages = pages[table]?.slice(1) ?? [];
    mockPages[table].push(...extraPages);
  }
  mockRanges = [];
  jest
    .mocked(getSupabase)
    .mockReturnValue(createSupabaseMock() as unknown as ReturnType<typeof getSupabase>);
}

describe('buildUserDataExport', () => {
  beforeEach(() => configureSupabaseMock());

  it('exports all related records and fetches full pages until the final partial page', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `food-${index}` }));
    const lastPage = [{ id: 'food-1000' }];
    configureSupabaseMock(
      {},
      {
        food_entries: [
          { data: firstPage, error: null },
          { data: lastPage, error: null },
        ],
      },
    );

    const result = await buildUserDataExport('user-1');

    expect(result.format).toBe('fam-user-export-v1');
    expect(result.profile).toEqual({ id: 'user-1' });
    expect(result.childProfiles).toEqual([{ id: 'child-1' }]);
    expect(result.householdMemberships).toEqual([{ id: 'membership-1' }]);
    expect(result.foodEntries).toHaveLength(1001);
    expect(result.foodEntries.at(-1)).toEqual({ id: 'food-1000' });
    expect(mockRanges).toContainEqual({ table: 'food_entries', from: 0, to: 999 });
    expect(mockRanges).toContainEqual({ table: 'food_entries', from: 1000, to: 1999 });
    expect(result.exportedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('uses empty arrays when child or membership data is null', async () => {
    configureSupabaseMock({
      child_profiles: { data: null, error: null },
      household_members: { data: null, error: null },
    });

    const result = await buildUserDataExport('user-1');

    expect(result.childProfiles).toEqual([]);
    expect(result.householdMemberships).toEqual([]);
  });

  it.each([
    ['profile', 'profiles'],
    ['child profile', 'child_profiles'],
    ['household membership', 'household_members'],
    ['paged table', 'user_goals'],
  ] as const)('throws the %s query error', async (_label, table) => {
    const failure = new Error(`${table} failed`);
    if (table === 'user_goals') {
      configureSupabaseMock({}, { user_goals: [{ data: null, error: failure }] });
    } else {
      configureSupabaseMock({ [table]: { data: null, error: failure } });
    }

    await expect(buildUserDataExport('user-1')).rejects.toBe(failure);
  });

  it('stops immediately on an empty page and exports an absent profile as null', async () => {
    configureSupabaseMock(
      { profiles: { data: null, error: null } },
      { user_goals: [{ data: null, error: null }] },
    );

    const result = await buildUserDataExport('user-1');

    expect(result.profile).toBeNull();
    expect(result.goals).toEqual([]);
    expect(mockRanges.filter((range) => range.table === 'user_goals')).toHaveLength(1);
  });
});
