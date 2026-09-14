import { render, userEvent } from '@testing-library/react-native';

import { FeatureFlagControls } from '@/features/settings/dev/feature-flag-controls';

let mockOverrides: Record<string, boolean> = {};
let mockFlags: Record<string, boolean | string> | undefined;
const mockSetOverride = jest.fn();
const mockResetOverrides = jest.fn();

jest.mock('@/constants/dev-settings', () => ({
  useDevSettingsStore: (
    selector: (state: {
      moduleFeatureFlagOverrides: Record<string, boolean>;
      setModuleFeatureFlagOverride: typeof mockSetOverride;
      resetModuleFeatureFlagOverrides: typeof mockResetOverrides;
    }) => unknown,
  ) =>
    selector({
      moduleFeatureFlagOverrides: mockOverrides,
      setModuleFeatureFlagOverride: mockSetOverride,
      resetModuleFeatureFlagOverrides: mockResetOverrides,
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

jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFlags,
}));

beforeEach(() => {
  mockOverrides = {};
  mockFlags = {
    'module-calories': false,
    'module-recipes': true,
    'module-meal-planner': true,
  };
  mockSetOverride.mockClear();
  mockResetOverrides.mockClear();
});

describe('FeatureFlagControls', () => {
  it('zeigt alle fünf Modul-Feature-Schalter', async () => {
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
  });

  it('zeigt fehlende Remote-Werte als nicht geladen an', async () => {
    mockFlags = { 'module-calories': true };
    const view = await render(<FeatureFlagControls />);

    expect(view.getByText(/Remote-Flag module-recipes: nicht geladen/)).toBeOnTheScreen();
  });
});
