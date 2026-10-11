import { render, screen, userEvent } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { UpdateExperience } from './update-experience';

type MockUpdateInfo = {
  updateId?: string;
  manifest?: { extra?: { expoClient?: { extra?: { showUpdateExperience?: boolean } } } };
};

type MockUpdateState = {
  availableUpdate?: MockUpdateInfo;
  downloadedUpdate?: MockUpdateInfo;
  downloadError?: Error;
  downloadProgress?: number;
  isDownloading: boolean;
  isRestarting: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
};

const mockUpdateState: MockUpdateState = {
  availableUpdate: undefined,
  downloadedUpdate: undefined,
  downloadError: undefined,
  downloadProgress: undefined,
  isDownloading: false,
  isRestarting: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
};
const mockExpoExtra = { dummyUpdateExperience: true };
const mockReloadAsync = jest.fn<Promise<void>, []>();
let mockUpdatesEnabled = false;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExpoExtra };
    },
  },
}));

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockUpdatesEnabled;
  },
  useUpdates: () => mockUpdateState,
  reloadAsync: () => mockReloadAsync(),
}));

describe('UpdateExperience', () => {
  beforeEach(() => {
    mockExpoExtra.dummyUpdateExperience = true;
    mockUpdatesEnabled = false;
    mockUpdateState.availableUpdate = undefined;
    mockUpdateState.downloadedUpdate = undefined;
    mockUpdateState.downloadError = undefined;
    mockUpdateState.downloadProgress = undefined;
    mockUpdateState.isDownloading = false;
    mockUpdateState.isRestarting = false;
    mockUpdateState.isUpdateAvailable = false;
    mockUpdateState.isUpdatePending = false;
    mockReloadAsync.mockReset().mockResolvedValue(undefined);
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('shows and dismisses its config-enabled preview even when OTA updates are disabled', async () => {
    await render(<UpdateExperience />);

    expect(screen.getByText('Fam wird gerade aktualisiert.')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Update weiterladen und Fam öffnen' }));

    expect(screen.queryByText('Fam wird gerade aktualisiert.')).not.toBeOnTheScreen();
  });

  it.each([
    [0.456, '46%', 'Verbesserungen werden geladen · 46 %'],
    [1.5, '100%', 'Verbesserungen werden geladen · 100 %'],
    [-0.4, '0%', 'Verbesserungen werden geladen · 0 %'],
  ])('shows the clamped OTA download progress for %s', async (downloadProgress, value, label) => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.availableUpdate = {
      updateId: 'available-update',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isUpdateAvailable = true;
    mockUpdateState.downloadProgress = downloadProgress;

    await render(<UpdateExperience />);

    expect(screen.getByText(value)).toBeOnTheScreen();
    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it('shows an indeterminate state for invalid progress and stops animation for reduced motion', async () => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.availableUpdate = {
      updateId: 'available-update',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isUpdateAvailable = true;
    mockUpdateState.downloadProgress = Number.NaN;
    jest.mocked(useReducedMotion).mockReturnValue(true);

    await render(<UpdateExperience />);

    expect(screen.getByText('···')).toBeOnTheScreen();
    expect(screen.getByText('Verbesserungen werden geladen')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Update weiterladen und Fam öffnen' }),
    ).toBeOnTheScreen();
  });

  it('shows a ready update, reloads on request, and lets the user dismiss it', async () => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.downloadedUpdate = {
      updateId: 'downloaded-update',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isUpdatePending = true;
    mockUpdateState.downloadProgress = 0.5;
    const user = userEvent.setup();

    await render(<UpdateExperience />);

    expect(screen.getByText('Fam ist bereit.')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    const restart = screen.getByRole('button', { name: 'Fam jetzt mit dem Update neu starten' });
    await user.press(restart);
    expect(mockReloadAsync).toHaveBeenCalledTimes(1);

    await user.press(screen.getByRole('button', { name: 'Später' }));
    expect(screen.queryByText('Fam ist bereit.')).not.toBeOnTheScreen();
  });

  it('shows an error after a failed reload and lets the user retry', async () => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.downloadedUpdate = {
      updateId: 'downloaded-update',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isUpdatePending = true;
    mockReloadAsync.mockRejectedValueOnce(new Error('reload unavailable'));
    const user = userEvent.setup();

    await render(<UpdateExperience />);
    await user.press(screen.getByRole('button', { name: 'Fam jetzt mit dem Update neu starten' }));

    expect(await screen.findByText('Das Update wartet noch.')).toBeOnTheScreen();
    expect(screen.getByText('Update angehalten')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Fam jetzt mit dem Update neu starten' }),
    ).toHaveTextContent('Erneut versuchen');

    await user.press(screen.getByRole('button', { name: 'Fam jetzt mit dem Update neu starten' }));
    expect(mockReloadAsync).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Fam ist bereit.')).toBeOnTheScreen();
  });

  it('hides OTA updates without the manifest opt-in or an active update', async () => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.availableUpdate = { updateId: 'unapproved', manifest: { extra: {} } };
    mockUpdateState.isUpdateAvailable = true;
    const view = await render(<UpdateExperience />);

    expect(screen.queryByText('Fam wird gerade aktualisiert.')).not.toBeOnTheScreen();

    mockUpdateState.availableUpdate = {
      updateId: 'approved-but-idle',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isUpdateAvailable = false;
    await view.rerender(<UpdateExperience />);

    expect(screen.queryByText('Fam wird gerade aktualisiert.')).not.toBeOnTheScreen();
  });

  it('shows a download error without progress text', async () => {
    mockExpoExtra.dummyUpdateExperience = false;
    mockUpdatesEnabled = true;
    mockUpdateState.availableUpdate = {
      updateId: 'failed-download',
      manifest: { extra: { expoClient: { extra: { showUpdateExperience: true } } } },
    };
    mockUpdateState.isDownloading = true;
    mockUpdateState.downloadError = new Error('download failed');

    await render(<UpdateExperience />);

    expect(screen.getByText('Das Update wartet noch.')).toBeOnTheScreen();
    expect(screen.getByText('Update angehalten')).toBeOnTheScreen();
    expect(screen.getByText('···')).toBeOnTheScreen();
  });
});
