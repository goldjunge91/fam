import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../test/node-sqlite-adapter';
import type { AssistantProposal } from '../types';

let mockUuidCounter = 0;

jest.doMock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => `00000000-0000-4000-8000-${String(++mockUuidCounter).padStart(12, '0')}`,
  ),
}));
jest.doMock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.doMock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));
jest.doMock('@/lib/telemetry', () => ({ addDiagnosticStep: jest.fn(), reportError: jest.fn() }));
jest.doMock('./assistant-api', () => ({
  validateAssistantMealPlanProposal: jest.fn().mockResolvedValue({ valid: true }),
}));

const { getDatabase } = jest.requireMock('@/lib/db/local-client') as {
  getDatabase: jest.MockedFunction<() => Promise<TestDatabase>>;
};
const { applyAssistantMealPlanProposal } =
  require('./apply-meal-plan-proposal') as typeof import('./apply-meal-plan-proposal');

function proposal(): Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }> {
  return {
    kind: 'meal_plan_proposal.v1',
    foodRulesUpdatedAt: '2026-11-08T09:00:00.000Z',
    foodRuleCoverage: {
      status: 'clear',
      rulesUpdatedAt: '2026-11-08T09:00:00.000Z',
      recipeVersions: [
        {
          recipeId: 'recipe-1',
          recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
          coverageVersion: 'reviewed-evidence-v1',
        },
      ],
    },
    meals: [
      {
        date: '2026-11-09',
        mealSlot: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Tomatenpfanne',
        recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
        portions: 2,
        rationale: 'Für Montag.',
      },
      {
        date: '2026-11-11',
        mealSlot: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Tomatenpfanne',
        recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
        portions: 3,
        rationale: 'Für Mittwoch.',
      },
    ],
    safetyNote: 'Regeln wurden abgeglichen.',
  };
}

describe('applyAssistantMealPlanProposal SQLite transaction', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    mockUuidCounter = 0;
    db = createTestDatabase();
    await applyLocalSchema(db);
    getDatabase.mockResolvedValue(db);
    await db.runAsync(
      `insert into recipes (id, household_id, title, updated_at, _dirty)
       values (?, ?, ?, ?, 0)`,
      ['recipe-1', 'household-1', 'Tomatenpfanne', Date.parse('2026-11-08T08:30:00.000Z')],
    );
  });

  afterEach(() => {
    db.close();
  });

  it('applies a validated proposal to the plan, entries, and outbox atomically', async () => {
    const result = await applyAssistantMealPlanProposal({
      householdId: 'household-1',
      userId: 'user-1',
      proposal: proposal(),
    });

    expect(result).toEqual({ addedCount: 2, totalCount: 2 });
    await expect(
      db.getAllAsync<{ id: string; household_id: string; week_start_date: string }>(
        'select id, household_id, week_start_date from meal_plans',
      ),
    ).resolves.toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        household_id: 'household-1',
        week_start_date: '2026-11-09',
      },
    ]);
    await expect(
      db.getAllAsync<{
        id: string;
        meal_plan_id: string;
        household_id: string;
        recipe_id: string;
        entry_date: string;
        meal_slot: string;
        portions: number;
      }>(
        'select id, meal_plan_id, household_id, recipe_id, entry_date, meal_slot, portions ' +
          'from meal_plan_entries order by entry_date',
      ),
    ).resolves.toEqual([
      {
        id: '00000000-0000-4000-8000-000000000002',
        meal_plan_id: '00000000-0000-4000-8000-000000000001',
        household_id: 'household-1',
        recipe_id: 'recipe-1',
        entry_date: '2026-11-09',
        meal_slot: 'dinner',
        portions: 2,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        meal_plan_id: '00000000-0000-4000-8000-000000000001',
        household_id: 'household-1',
        recipe_id: 'recipe-1',
        entry_date: '2026-11-11',
        meal_slot: 'dinner',
        portions: 3,
      },
    ]);
    const outbox = await db.getAllAsync<{
      entity: string;
      entity_id: string;
      op: string;
      payload: string;
    }>('select entity, entity_id, op, payload from outbox order by id');
    expect(outbox.map(({ entity, entity_id, op }) => ({ entity, entity_id, op }))).toEqual([
      {
        entity: 'meal_plans',
        entity_id: '00000000-0000-4000-8000-000000000001',
        op: 'insert',
      },
      {
        entity: 'meal_plan_entries',
        entity_id: '00000000-0000-4000-8000-000000000002',
        op: 'insert',
      },
      {
        entity: 'meal_plan_entries',
        entity_id: '00000000-0000-4000-8000-000000000003',
        op: 'insert',
      },
    ]);
    expect(JSON.parse(outbox[0]?.payload ?? '{}')).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      household_id: 'household-1',
      week_start_date: '2026-11-09',
    });
  });

  it('rolls back the plan, earlier entries, and outbox if a later outbox write fails', async () => {
    await db.execAsync(`
      create trigger fail_recipe_plan_entry
      before insert on outbox
      when new.entity = 'meal_plan_entries' and (
        select count(*) from outbox where entity = 'meal_plan_entries'
      ) = 1
      begin
        select raise(abort, 'forced meal entry outbox failure');
      end;
    `);

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: proposal(),
      }),
    ).rejects.toThrow('forced meal entry outbox failure');

    await expect(db.getAllAsync('select id from meal_plans')).resolves.toEqual([]);
    await expect(db.getAllAsync('select id from meal_plan_entries')).resolves.toEqual([]);
    await expect(db.getAllAsync('select id from outbox')).resolves.toEqual([]);
    await expect(db.getAllAsync('select id from outbox_history')).resolves.toEqual([]);
  });
});
