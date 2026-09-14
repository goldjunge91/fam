import { renderHook } from '@testing-library/react-native';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import { useFeatureAccess } from '@/features/settings/use-feature-access';

let mockModulePreferences: ModulePreferences = {
  fridge: true,
  shoppingList: true,
  calories: true,
  recipes: true,
  mealPlanner: true,
};

let mockFeatureFlags: Record<string, boolean | string> | undefined = {
  'test-feature': false,
  'workout-log': false,
  'low-carb-tracking': false,
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};
let mockModuleFeatureFlagOverrides: Partial<Record<keyof ModulePreferences, boolean>> = {};

jest.mock('@/constants/dev-settings', () => ({
  useDevSettingsStore: (
    selector: (state: {
      moduleFeatureFlagOverrides: Partial<Record<keyof ModulePreferences, boolean>>;
    }) => unknown,
  ) => selector({ moduleFeatureFlagOverrides: mockModuleFeatureFlagOverrides }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  DEFAULT_MODULE_PREFERENCES: {
    fridge: true,
    shoppingList: true,
    calories: true,
    recipes: true,
    mealPlanner: true,
  },
  useModulePreferences: () => ({
    data: mockModulePreferences,
    isLoading: false,
  }),
}));

jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: string, defaultValue: boolean) =>
    mockFeatureFlags?.[key] === true
      ? true
      : mockFeatureFlags?.[key] === false
        ? false
        : defaultValue,
}));

describe('useFeatureAccess', () => {
  const originalDevTools = process.env.EXPO_PUBLIC_DEV_TOOLS;

  beforeEach(() => {
    mockModulePreferences = {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    };
    mockFeatureFlags = {
      'test-feature': false,
      'workout-log': true,
      'low-carb-tracking': true,
      'module-recipes': true,
      'module-meal-planner': true,
      'module-calories': true,
    };
    mockModuleFeatureFlagOverrides = {};
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'false';
  });

  afterAll(() => {
    if (originalDevTools === undefined) delete process.env.EXPO_PUBLIC_DEV_TOOLS;
    else process.env.EXPO_PUBLIC_DEV_TOOLS = originalDevTools;
  });

  it('erkennt ein aktives Modul ohne Feature Flag per FeatureId (z.B. fridge)', async () => {
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('fridge')).toBe(true);
    expect(result.current.isModuleLocked(undefined)).toBe(false);
  });

  it('deaktiviert ein Modul per FeatureId, wenn die Nutzer-Präferenz false ist', async () => {
    mockModulePreferences.fridge = false;
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('fridge')).toBe(false);
  });

  it('deaktiviert ein Modul per FeatureId, wenn das PostHog Feature Flag false ist', async () => {
    if (mockFeatureFlags) mockFeatureFlags['module-recipes'] = false;
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('recipes')).toBe(false);
    expect(result.current.isModuleLocked('module-recipes')).toBe(true);
  });

  it('deaktiviert ein Sub-Feature per FeatureId, wenn das Parent-Modul deaktiviert ist', async () => {
    mockModulePreferences.calories = false;
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('workouts')).toBe(false);
    expect(result.current.isFeatureEnabled('low-carb')).toBe(false);
  });

  it('deaktiviert ein Sub-Feature per FeatureId, wenn dessen eigenes Feature Flag false ist', async () => {
    if (mockFeatureFlags) mockFeatureFlags['workout-log'] = false;
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('workouts')).toBe(false);
  });

  it('aktiviert ein Sub-Feature per FeatureId, wenn Parent-Modul und eigenes Flag true sind', async () => {
    mockModulePreferences.calories = true;
    if (mockFeatureFlags) mockFeatureFlags['workout-log'] = true;
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('workouts')).toBe(true);
  });

  it('behandelt String-Varianten von Flags nicht als boolean true', async () => {
    if (mockFeatureFlags) mockFeatureFlags['module-recipes'] = 'variant-b';
    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.isFeatureEnabled('recipes')).toBe(false);
  });

  it('liefert Tri-State-Werte über getFeatureFlagState', async () => {
    mockFeatureFlags = undefined;
    const { result: unhydrated } = await renderHook(() => useFeatureAccess());
    expect(unhydrated.current.getFeatureFlagState('module-recipes')).toBeUndefined();

    mockFeatureFlags = { 'module-recipes': true, 'module-calories': false };
    const { result: hydrated } = await renderHook(() => useFeatureAccess());
    expect(hydrated.current.getFeatureFlagState('module-recipes')).toBe(true);
    expect(hydrated.current.getFeatureFlagState('module-calories')).toBe(false);
  });

  it('wendet den lokalen Kalorien-Flag-Override im Entwickler-Modus an', async () => {
    mockFeatureFlags = { 'module-calories': false };
    mockModuleFeatureFlagOverrides = { calories: true };
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'true';

    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.getFeatureFlagState('module-calories')).toBe(true);
    expect(result.current.isFeatureEnabled('calories')).toBe(true);
    expect(result.current.isModuleLocked('module-calories')).toBe(false);
  });

  it('ignoriert den lokalen Override außerhalb des Entwickler-Modus', async () => {
    mockFeatureFlags = { 'module-calories': false };
    mockModuleFeatureFlagOverrides = { calories: true };

    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.getFeatureFlagState('module-calories')).toBe(false);
    expect(result.current.isFeatureEnabled('calories')).toBe(false);
    expect(result.current.isModuleLocked('module-calories')).toBe(true);
  });

  it('wendet den lokalen Override auch auf ein Modul ohne Remote-Flag an', async () => {
    mockModuleFeatureFlagOverrides = { fridge: false };
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'true';

    const { result } = await renderHook(() => useFeatureAccess());

    expect(result.current.getModuleFeatureFlagOverride('fridge')).toBe(false);
    expect(result.current.isFeatureEnabled('fridge')).toBe(false);
  });
});
