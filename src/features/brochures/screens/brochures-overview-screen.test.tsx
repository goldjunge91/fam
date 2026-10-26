import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { BrochurePostalCodeState } from '../hooks/use-brochure-postal-code';

const mockRouterPush = jest.fn();
const mockRetryLocation = jest.fn();
const mockSetManualPostalCode = jest.fn().mockResolvedValue(undefined);
const mockUseDeviceLocation = jest.fn();
const mockOpenDrawer = jest.fn();
const mockOpenProfile = jest.fn();
let mockLocation: BrochurePostalCodeState;
let mockSync = { isSyncing: false, hasSynced: true };
let mockBrochureQuery: { data: typeof brochureData | undefined; isLoading: boolean };

const brochureData = {
  cacheZip: '10115',
  stores: [
    {
      id: 'rewe',
      name: 'REWE',
      logoUrl: 'https://offerscdn.bringapi.app/content/rewe.png',
      active: true,
      isFavorite: true,
    },
    { id: 'aldi', name: 'Aldi', logoUrl: null, active: true, isFavorite: true },
    { id: 'unused', name: 'Unused', logoUrl: null, active: true, isFavorite: false },
  ],
  favorites: [
    {
      id: 'rewe',
      name: 'REWE',
      logoUrl: 'https://offerscdn.bringapi.app/content/rewe.png',
      active: true,
      isFavorite: true,
    },
    { id: 'aldi', name: 'Aldi', logoUrl: null, active: true, isFavorite: true },
  ],
  brochures: [
    {
      id: 'brochure-rewe',
      storeId: 'rewe',
      title: 'REWE Angebote',
      validFrom: '2026-10-10',
      validUntil: '2026-10-16',
      coverImage: 'https://offerscdn.bringapi.app/content/rewe-cover.jpg',
    },
    {
      id: 'brochure-aldi',
      storeId: 'aldi',
      title: 'Aldi Angebote',
      validFrom: '2026-10-10',
      validUntil: '2026-10-16',
      coverImage: 'https://offerscdn.bringapi.app/content/aldi-cover.jpg',
    },
  ],
  imageReferences: [],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => mockRouterPush(...args) }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: mockOpenDrawer, openProfile: mockOpenProfile }),
}));
jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));
jest.mock('../hooks/use-brochure-postal-code', () => ({
  useBrochurePostalCode: () => mockLocation,
}));
jest.mock('../hooks/use-brochure-sync', () => ({ useBrochureSync: () => mockSync }));
jest.mock('../hooks/use-brochures', () => ({ useBrochures: () => mockBrochureQuery }));

const { default: SharedBrochuresOverviewScreen } = jest.requireActual(
  './brochures-overview-screen.tsx',
) as typeof import('./brochures-overview-screen');
const { default: AndroidBrochuresOverviewScreen } = jest.requireActual(
  './brochures-overview-screen.android.tsx',
) as typeof import('./brochures-overview-screen.android');

const screenVariants = [
  ['shared', SharedBrochuresOverviewScreen],
  ['Android', AndroidBrochuresOverviewScreen],
] as const;

describe.each(screenVariants)('BrochuresOverviewScreen (%s)', (_name, ScreenComponent) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation = {
      status: 'ready',
      postalCode: '10115',
      retry: mockRetryLocation,
      canAskAgain: true,
      isManual: false,
      setManualPostalCode: mockSetManualPostalCode,
      useDeviceLocation: mockUseDeviceLocation,
    };
    mockSync = { isSyncing: false, hasSynced: true };
    mockBrochureQuery = { data: brochureData, isLoading: false };
  });

  it('shows locating, retryable denial and permanent denial states', async () => {
    mockLocation = { ...mockLocation, status: 'locating', postalCode: null };
    const locating = await render(<ScreenComponent />);
    expect(screen.getByText('Standort wird ermittelt...')).toBeOnTheScreen();
    await locating.unmount();

    mockLocation = { ...mockLocation, status: 'error', postalCode: null };
    const failed = await render(<ScreenComponent />);
    expect(screen.getByText('Deine PLZ konnte gerade nicht ermittelt werden.')).toBeOnTheScreen();
    await failed.unmount();

    mockLocation = { ...mockLocation, status: 'denied', postalCode: null, canAskAgain: true };
    const retryable = await render(<ScreenComponent />);
    await fireEvent.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockRetryLocation).toHaveBeenCalledTimes(1);
    await retryable.unmount();

    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockLocation = { ...mockLocation, status: 'denied', postalCode: null, canAskAgain: false };
    await render(<ScreenComponent />);
    await fireEvent.press(screen.getByRole('button', { name: 'Einstellungen öffnen' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('offers manual postal-code entry for unavailable locations and saves it', async () => {
    const user = userEvent.setup();
    mockLocation = { ...mockLocation, status: 'unavailable', postalCode: null };
    await render(<ScreenComponent />);

    await user.press(screen.getByRole('button', { name: 'PLZ manuell eingeben' }));
    await user.type(screen.getByLabelText('PLZ'), '10117');
    await user.press(screen.getByRole('button', { name: 'Postleitzahl übernehmen' }));

    expect(mockSetManualPostalCode).toHaveBeenCalledWith('10117');
    expect(screen.getByRole('button', { name: 'PLZ manuell eingeben' })).toBeOnTheScreen();
  });

  it('shows synchronized offers with favorite stores, filters them and opens a brochure', async () => {
    const user = userEvent.setup();
    await render(<ScreenComponent />);

    expect(screen.getByText('PLZ 10115')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'REWE' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Aldi' })).toBeOnTheScreen();
    expect(screen.queryByText('Unused')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('REWE Angebote'));
    expect(mockRouterPush).toHaveBeenCalledWith('/brochures/brochure-rewe');

    await user.press(screen.getByRole('button', { name: 'Aldi' }));
    expect(screen.getByText('Aldi Angebote')).toBeOnTheScreen();
    expect(screen.queryByText('REWE Angebote')).not.toBeOnTheScreen();
  });

  it('shows loading, an empty catalog and the manual-location switch', async () => {
    mockSync = { isSyncing: true, hasSynced: false };
    const loading = await render(<ScreenComponent />);
    expect(screen.getByText('Angebote für 10115 werden geladen...')).toBeOnTheScreen();
    await loading.unmount();

    mockSync = { isSyncing: false, hasSynced: true };
    mockBrochureQuery = {
      data: { ...brochureData, cacheZip: '22043' },
      isLoading: false,
    };
    const wrongPostalCode = await render(<ScreenComponent />);
    expect(screen.getByText('Noch keine Prospekte')).toBeOnTheScreen();
    await wrongPostalCode.unmount();

    mockBrochureQuery = {
      data: { ...brochureData, brochures: [], favorites: [], stores: [] },
      isLoading: false,
    };
    const empty = await render(<ScreenComponent />);
    expect(screen.getByText('Keine Prospekte.')).toBeOnTheScreen();
    await empty.unmount();

    mockLocation = { ...mockLocation, isManual: true };
    await render(<ScreenComponent />);
    await fireEvent.press(screen.getByRole('button', { name: 'Standort verwenden' }));
    expect(mockUseDeviceLocation).toHaveBeenCalledTimes(1);
  });

  it('lets the user cancel postal-code editing', async () => {
    const user = userEvent.setup();
    await render(<ScreenComponent />);
    await user.press(screen.getByRole('button', { name: 'PLZ ändern' }));
    await user.press(screen.getByRole('button', { name: 'Postleitzahl-Eingabe abbrechen' }));
    expect(screen.queryByLabelText('PLZ')).not.toBeOnTheScreen();
  });
});
