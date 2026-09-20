import { render, userEvent } from '@testing-library/react-native';

import { FeatureFlagControls } from '@/features/settings/dev/feature-flag-controls';

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

beforeEach(() => {
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
      'Kühlschrank & Vorrat ausschalten',
      'Geteilte Einkaufsliste ausschalten',
      'Kalorien Tracking einschalten',
      'Rezepte ausschalten',
      'Essensplan ausschalten',
    ]) {
      expect(view.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(view.getByText(/Remote-Flag module-calories: aus/)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Spracheingabe einschalten' })).toBeOnTheScreen();
    expect(view.getByText(/Remote-Flag shopping-stt: nicht geladen/)).toBeOnTheScreen();
  });

  it('aktiviert den lokalen Override für shopping-stt', async () => {
    mockFlags = { 'shopping-stt': false };
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(view.getByRole('button', { name: 'Spracheingabe einschalten' }));

    expect(mockSetFeatureOverride).toHaveBeenCalledWith('shopping-stt', true);
  });

  it('aktiviert den lokalen Override für Kalorien Tracking', async () => {
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(view.getByRole('button', { name: 'Kalorien Tracking einschalten' }));

    expect(mockSetOverride).toHaveBeenCalledWith('calories', true);
  });

  it('kann den lokalen Override zurücksetzen', async () => {
    mockOverrides = { calories: true };
    const view = await render(<FeatureFlagControls />);
    const user = userEvent.setup();

    await user.press(view.getByRole('button', { name: 'Feature-Flag-Overrides zurücksetzen' }));

    expect(mockResetOverrides).toHaveBeenCalled();
    expect(mockResetFeatureOverrides).toHaveBeenCalled();
  });

  it('zeigt fehlende Remote-Werte als nicht geladen an', async () => {
    mockFlags = { 'module-calories': true };
    const view = await render(<FeatureFlagControls />);

    expect(view.getByText(/Remote-Flag module-recipes: nicht geladen/)).toBeOnTheScreen();
  });
});
