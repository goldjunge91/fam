import { render, screen, userEvent } from '@testing-library/react-native';
import { UpdateExperience } from './update-experience';

const mockUpdateState = {
  availableUpdate: undefined,
  downloadedUpdate: undefined,
  downloadError: undefined,
  downloadProgress: undefined,
  isDownloading: false,
  isRestarting: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { dummyUpdateExperience: true } } },
}));

jest.mock('expo-updates', () => ({
  isEnabled: false,
  useUpdates: () => mockUpdateState,
  reloadAsync: jest.fn(),
}));

describe('UpdateExperience', () => {
  it('shows and dismisses its config-enabled preview even when OTA updates are disabled', async () => {
    await render(<UpdateExperience />);

    expect(screen.getByText('Fam wird gerade aktualisiert.')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Update weiterladen und Fam öffnen' }));

    expect(screen.queryByText('Fam wird gerade aktualisiert.')).not.toBeOnTheScreen();
  });
});
