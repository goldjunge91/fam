import { render, userEvent } from '@testing-library/react-native';
import { FeatureFlagControls } from '@/features/settings/dev/feature-flag-controls';
import { i18n } from '@/i18n';

let mockOverrides: Record<string, boolean> = {};
let mockFlags: Record<string, boolean | string> | undefined;
const mockSetOverride = jest.fn();
const mockResetOverrides = jest.fn();
let mockFeatureOverrides: Record<string, boolean> = {};
const mockSetFeatureOverride = jest.fn();
const mockResetFeatureOverrides = jest.fn();

jest.mock('@/constants/dev-settings', () => ({
  useDevSettingsStore: (
    selector: (state: {
      moduleFeatureFlagOverrides: Record<string, boolean>;
      setModuleFeatureFlagOverride: typeof mockSetOverride;
      resetModuleFeatureFlagOverrides: typeof mockResetOverrides;
      featureFlagOverrides: Record<string, boolean>;
      setFeatureFlagOverride: typeof mockSetFeatureOverride;
      resetFeatureFlagOverrides: typeof mockResetFeatureOverrides;
    }) => unknown,
  ) =>
    selector({
      moduleFeatureFlagOverrides: mockOverrides,
      setModuleFeatureFlagOverride: mockSetOverride,
      resetModuleFeatureFlagOverrides: mockResetOverrides,
      featureFlagOverrides: mockFeatureOverrides,
      setFeatureFlagOverride: mockSetFeatureOverride,
      resetFeatureFlagOverrides: mockResetFeatureOverrides,
    }),
}));

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    getFeatureFlagState: (flag: string | undefined) => {
      const value = flag === undefined ? undefined : mockFlags?.[flag];
      return value === true ? true : value === false ? false : undefined;
    },
  }),
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  useFeatureFlags: () => mockFlags,
}));

beforeEach(async () => {
  await i18n.changeLanguage('de');
  mockOverrides = {};
  mockFeatureOverrides = {};
  mockFlags = {
    'module-calories': false,
    'module-recipes': true,
    'module-meal-planner': true,
  };
  mockSetOverride.mockClear();
  mockResetOverrides.mockClear();
  mockSetFeatureOverride.mockClear();
  mockResetFeatureOverrides.mockClear();
});

describe('FeatureFlagControls', () => {
  it('zeigt Modul- und Shopping-STT-Feature-Schalter', async () => {
    const view = await render(<FeatureFlagControls />);

    for (const label of [
      `${i18n.t('common.modules.fridge.title')} ${i18n.t('dev.featureFlags.turnOff')}`,
      `${i18n.t('common.modules.shoppingList.title')} ${i18n.t('dev.featureFlags.turnOff')}`,
      `${i18n.t('common.modules.calories.title')} ${i18n.t('dev.featureFlags.turnOn')}`,
      `${i18n.t('common.modules.recipes.title')} ${i18n.t('dev.featureFlags.turnOff')}`,
      `${i18n.t('common.modules.mealPlanner.title')} ${i18n.t('dev.featureFlags.turnOff')}`,
    ]) {
      expect(view.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(
      view.getByText(
        i18n.t('dev.featureFlags.remote', {
          flag: 'module-calories',
          value: i18n.t('dev.states.offLower'),
        }),
      ),
    ).toBeOnTheScreen();
    expect(
      view.getByRole('button', {
        name: `${i18n.t('dev.featureFlags.shoppingSpeech')} ${i18n.t('dev.featureFlags.turnOn')}`,
      }),
    ).toBeOnTheScreen();
    expect(
      view.getByText(
        i18n.t('dev.featureFlags.remote', {
          flag: 'shopping-stt',
          value: i18n.t('dev.states.notLoaded'),
        }),
      ),
    ).toBeOnTheScreen();
  });

  it('aktiviert den lokalen Override für shopping-stt', async () => {
    mockFlags = { 'shopping-stt': false };
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(
      view.getByRole('button', {
        name: `${i18n.t('dev.featureFlags.shoppingSpeech')} ${i18n.t('dev.featureFlags.turnOn')}`,
      }),
    );

    expect(mockSetFeatureOverride).toHaveBeenCalledWith('shopping-stt', true);
  });

  it('aktiviert den lokalen Override für Kalorien Tracking', async () => {
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(
      view.getByRole('button', {
        name: `${i18n.t('common.modules.calories.title')} ${i18n.t('dev.featureFlags.turnOn')}`,
      }),
    );

    expect(mockSetOverride).toHaveBeenCalledWith('calories', true);
  });

  it('kann den lokalen Override zurücksetzen', async () => {
    mockOverrides = { calories: true };
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(view.getByRole('button', { name: i18n.t('dev.featureFlags.reset') }));

    expect(mockResetOverrides).toHaveBeenCalled();
    expect(mockResetFeatureOverrides).toHaveBeenCalled();
  });

  it('zeigt fehlende Remote-Werte als nicht geladen an', async () => {
    mockFlags = { 'module-calories': true };
    const view = await render(<FeatureFlagControls />);

    expect(
      view.getByText(
        i18n.t('dev.featureFlags.remote', {
          flag: 'module-recipes',
          value: i18n.t('dev.states.notLoaded'),
        }),
      ),
    ).toBeOnTheScreen();
  });
});
