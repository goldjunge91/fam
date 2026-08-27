import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModuleSelectorForm } from '@/features/onboarding/components/module-selector';

const mockUpdateModulesData = jest.fn();
let mockModules = {
  fridge: true,
  shoppingList: true,
  calories: true,
  recipes: true,
  mealPlanner: true,
};

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
    data: mockModules,
    isLoading: false,
  }),
}));

jest.mock('@/features/onboarding/onboarding-store', () => ({
  useOnboarding: () => ({
    state: { modules: mockModules },
    updateModulesData: mockUpdateModulesData,
  }),
}));

let mockFeatureFlags: Record<string, boolean> = {
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};

jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: string | undefined, defaultValue: boolean) =>
    key ? (mockFeatureFlags[key] ?? defaultValue) : defaultValue,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

const onNext = jest.fn();
const onSkip = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockModules = {
    fridge: true,
    shoppingList: true,
    calories: true,
    recipes: true,
    mealPlanner: true,
  };
  mockFeatureFlags = {
    'module-recipes': true,
    'module-meal-planner': true,
    'module-calories': true,
  };
});

describe('ModuleSelectorForm', () => {
  it('schaltet ein Modul beim Antippen um', async () => {
    await render(<ModuleSelectorForm onNext={onNext} onSkip={onSkip} />);

    await fireEvent.press(screen.getByText(/Rezepte/));

    expect(mockUpdateModulesData).toHaveBeenCalledWith({ recipes: false });
  });

  it('zeigt "Demnächst verfügbar" und ignoriert Taps, wenn der Feature-Flag eines Moduls aus ist', async () => {
    mockFeatureFlags['module-recipes'] = false;
    await render(<ModuleSelectorForm onNext={onNext} onSkip={onSkip} />);

    expect(screen.getByText('Demnächst verfügbar')).toBeTruthy();

    await fireEvent.press(screen.getByText(/Rezepte/));
    expect(mockUpdateModulesData).not.toHaveBeenCalled();
  });

  it('laesst Vorrat und Einkauf unberuehrt vom Feature-Flag-Zustand', async () => {
    mockFeatureFlags = {
      'module-recipes': false,
      'module-meal-planner': false,
      'module-calories': false,
    };
    await render(<ModuleSelectorForm onNext={onNext} onSkip={onSkip} />);

    await fireEvent.press(screen.getByText(/Kühlschrank & Vorrat/));
    expect(mockUpdateModulesData).toHaveBeenCalledWith({ fridge: false });
  });
});
