import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { ModuleSelectorForm } from '@/features/onboarding/components/module-selector';
import { PermissionsStepForm } from '@/features/onboarding/components/permissions-step';
import { WelcomeCarousel } from '@/features/onboarding/components/welcome-carousel';

type MockPermission = { granted: boolean; canAskAgain: boolean } | null;

let mockCameraPermission: MockPermission = null;
let mockLocationPermission: MockPermission = null;
const mockGetCameraPermission = jest.fn();
const mockRequestCameraPermission = jest.fn();
const mockGetLocationPermission = jest.fn();
const mockRequestLocationPermission = jest.fn();
const mockGetNotificationPermissionStatus = jest.fn();
const mockRequestNotificationPermissions = jest.fn();
const mockUpdatePermissionsData = jest.fn();
const mockUseForegroundPermissions = jest.fn();

const mockFeatureFlags: Record<string, boolean> = {
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

jest.mock('@/features/onboarding/onboarding-store', () => ({
  useOnboarding: () => ({
    state: {
      modules: {
        fridge: true,
        shoppingList: true,
        recipes: true,
        mealPlanner: true,
        calories: true,
      },
      permissions: {
        notificationsRequested: true,
        cameraRequested: true,
        locationRequested: true,
      },
    },
    updateModulesData: jest.fn(),
    updatePermissionsData: mockUpdatePermissionsData,
  }),
}));

jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [
    mockCameraPermission,
    mockRequestCameraPermission,
    mockGetCameraPermission,
  ],
}));

jest.mock('expo-location', () => ({
  useForegroundPermissions: () => mockUseForegroundPermissions(),
}));

jest.mock('@/lib/notifications', () => ({
  getNotificationPermissionStatus: (...args: unknown[]) =>
    mockGetNotificationPermissionStatus(...args),
  requestNotificationPermissions: (...args: unknown[]) =>
    mockRequestNotificationPermissions(...args),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  DEFAULT_MODULE_PREFERENCES: {
    fridge: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    calories: true,
  },
  useModulePreferences: () => ({
    data: {
      fridge: true,
      shoppingList: true,
      recipes: true,
      mealPlanner: true,
      calories: true,
    },
    isLoading: false,
  }),
}));

// Diese Komponententests pruefen die Onboarding-Schritte, nicht die
// PostHog-Anbindung. Alle optionalen Module sind hier bewusst freigeschaltet.
jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: string | undefined, defaultValue: boolean) =>
    key ? (mockFeatureFlags[key] ?? defaultValue) : defaultValue,
}));

describe('Onboarding Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraPermission = null;
    mockLocationPermission = null;
    mockUseForegroundPermissions.mockReturnValue([
      mockLocationPermission,
      mockRequestLocationPermission,
      mockGetLocationPermission,
    ]);
    mockGetNotificationPermissionStatus.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    mockRequestNotificationPermissions.mockResolvedValue(false);
  });

  describe('WelcomeCarousel', () => {
    it('rendert Willkommens-Folien und wechselt Folien beim Klick auf Weiter', async () => {
      const onStart = jest.fn();
      await render(<WelcomeCarousel onStart={onStart} />);

      expect(screen.getByText('Haushalt & Vorrat an einem Ort')).toBeTruthy();

      const nextBtn = screen.getByRole('button', { name: 'Weiter' });
      await fireEvent.press(nextBtn);

      expect(await screen.findByText('Geteilte Einkaufsliste')).toBeTruthy();
    });
  });

  describe('ModuleSelectorForm', () => {
    it('rendert Modulauswahl-Toggles', async () => {
      const onNext = jest.fn();
      const onSkip = jest.fn();
      await render(<ModuleSelectorForm onNext={onNext} onSkip={onSkip} />);

      expect(screen.getByText('Welche Module möchtest du nutzen?')).toBeTruthy();
      expect(screen.getByText(/Kühlschrank & Vorrat/)).toBeTruthy();
      expect(screen.getByText(/Geteilte Einkaufsliste/)).toBeTruthy();
      expect(screen.getByText(/Rezepte/)).toBeTruthy();
      expect(screen.getByText(/Essensplan/)).toBeTruthy();
      expect(screen.getByText(/Kalorienzähler & Tagebuch/)).toBeTruthy();
    });
  });

  describe('PermissionsStepForm', () => {
    it('stellt genau einen zugänglichen Switch pro Berechtigung bereit und toggelt per Karte', async () => {
      const user = userEvent.setup();
      mockRequestNotificationPermissions.mockResolvedValue(true);
      mockGetNotificationPermissionStatus
        .mockResolvedValueOnce({ granted: false, canAskAgain: true })
        .mockResolvedValue({ granted: true, canAskAgain: false });

      await render(<PermissionsStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

      expect(screen.getAllByRole('switch')).toHaveLength(3);
      const notifications = screen.getByRole('switch', { name: 'Benachrichtigungen' });
      expect(notifications).not.toBeChecked();

      await user.press(notifications);

      expect(screen.getByRole('switch', { name: 'Benachrichtigungen' })).toBeChecked();
    });

    it('startet alle Toggles aus, solange der native Status noch unbekannt ist', async () => {
      mockGetNotificationPermissionStatus.mockReturnValue(new Promise(() => {}));

      await render(<PermissionsStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

      expect(screen.getByLabelText('Benachrichtigungen').props.accessibilityState).toEqual({
        checked: false,
      });
      expect(screen.getByLabelText('Kamera-Zugriff').props.accessibilityState).toEqual({
        checked: false,
      });
      expect(screen.getByLabelText('Standort-Zugriff').props.accessibilityState).toEqual({
        checked: false,
      });
    });

    it('spiegelt die gelesenen nativen Permission-Zustaende wider', async () => {
      mockCameraPermission = { granted: true, canAskAgain: false };
      mockLocationPermission = { granted: true, canAskAgain: false };
      mockUseForegroundPermissions.mockReturnValue([
        mockLocationPermission,
        mockRequestLocationPermission,
        mockGetLocationPermission,
      ]);
      mockGetNotificationPermissionStatus.mockResolvedValue({
        granted: true,
        canAskAgain: false,
      });

      await render(<PermissionsStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Benachrichtigungen').props.accessibilityState).toEqual({
          checked: true,
        });
      });
      expect(screen.getByLabelText('Kamera-Zugriff').props.accessibilityState).toEqual({
        checked: true,
      });
      expect(screen.getByLabelText('Standort-Zugriff').props.accessibilityState).toEqual({
        checked: true,
      });
    });

    it('aktualisiert den Toggle nach einer erfolgreichen Berechtigungsanfrage', async () => {
      mockGetNotificationPermissionStatus
        .mockResolvedValueOnce({ granted: false, canAskAgain: true })
        .mockResolvedValue({ granted: true, canAskAgain: false });
      mockRequestNotificationPermissions.mockResolvedValue(true);

      await render(<PermissionsStepForm onNext={jest.fn()} onSkip={jest.fn()} />);
      await fireEvent.press(screen.getByLabelText('Benachrichtigungen'));

      await waitFor(() => {
        expect(screen.getByLabelText('Benachrichtigungen').props.accessibilityState).toEqual({
          checked: true,
        });
      });
    });
  });
});
