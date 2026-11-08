import type { SerializedSqlDatabase } from '@/lib/db/serialize';
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
  getDatabase: jest.MockedFunction<() => Promise<SerializedSqlDatabase>>;
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
    getDatabase.mockResolvedValue(db as unknown as SerializedSqlDatabase);
    await db.runAsync(
      `insert into recipes (id, household_id, title, updated_at, _dirty)
       values (?, ?, ?, ?, 0)`,
      ['recipe-1', 'household-1', 'Tomatenpfanne', Date.parse('2026-11-08T08:30:00.000Z')],
    );
  });

  afterEach(() => {
    db.close();
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
