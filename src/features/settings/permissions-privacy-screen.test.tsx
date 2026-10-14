import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { PermissionsScreen } from '@/features/settings/permissions-screen';
import { PrivacyScreen } from '@/features/settings/privacy-screen';

const mockShowAdsPrivacyOptions = jest.fn<Promise<boolean>, []>();
const privacyOptionsButton = () =>
  screen.getByRole('button', {
    name: 'settings.groups.data.privacy.adsSettings.openButton',
  });

async function pressPrivacyOptionsButton(): Promise<void> {
  await act(async () => userEvent.press(privacyOptionsButton()));
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/layout/screen', () => {
  const { Text: NativeText, View: NativeView } = require('react-native');
  return {
    Screen: ({ children, title }: { children: React.ReactNode; title: string }) => (
      <NativeView>
        <NativeText>{title}</NativeText>
        {children}
      </NativeView>
    ),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const { View: NativeView } = require('react-native');
  return {
    ContentCard: ({ children }: { children: React.ReactNode }) => (
      <NativeView>{children}</NativeView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const { Pressable: NativePressable, Text: NativeText } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      loading,
    }: {
      title: string;
      onPress?: () => void;
      loading?: boolean;
    }) => (
      <NativePressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
        <NativeText>{loading ? 'loading' : title}</NativeText>
      </NativePressable>
    ),
    Txt: ({ children }: { children: React.ReactNode }) => <NativeText>{children}</NativeText>,
  };
});

jest.mock('@/features/ads', () => ({
  showAdsPrivacyOptions: () => mockShowAdsPrivacyOptions(),
}));

jest.mock('@/features/settings/camera-permission-card', () => {
  const { Text: NativeText } = require('react-native');
  return { CameraPermissionCard: () => <NativeText>camera-permission</NativeText> };
});
jest.mock('@/features/settings/location-permission-card', () => {
  const { Text: NativeText } = require('react-native');
  return { LocationPermissionCard: () => <NativeText>location-permission</NativeText> };
});
jest.mock('@/features/settings/microphone-permission-card', () => {
  const { Text: NativeText } = require('react-native');
  return { MicrophonePermissionCard: () => <NativeText>microphone-permission</NativeText> };
});
jest.mock('@/features/settings/notification-permission-card', () => {
  const { Text: NativeText } = require('react-native');
  return { NotificationPermissionCard: () => <NativeText>notification-permission</NativeText> };
});

describe('PermissionsScreen', () => {
  it('shows the four permission categories', async () => {
    await render(<PermissionsScreen />);

    expect(screen.getByText('settings.groups.app.permissions.label')).toBeOnTheScreen();
    expect(screen.getByText('camera-permission')).toBeOnTheScreen();
    expect(screen.getByText('microphone-permission')).toBeOnTheScreen();
    expect(screen.getByText('notification-permission')).toBeOnTheScreen();
    expect(screen.getByText('location-permission')).toBeOnTheScreen();
  });
});

describe('PrivacyScreen', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    mockShowAdsPrivacyOptions.mockReset();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => alert.mockRestore());

  it('shows the privacy sections and opens the platform privacy options', async () => {
    mockShowAdsPrivacyOptions.mockResolvedValue(true);
    await render(<PrivacyScreen />);

    expect(
      screen.getByText('settings.groups.data.privacy.sections.dataProtection.title'),
    ).toBeOnTheScreen();
    await pressPrivacyOptionsButton();

    expect(mockShowAdsPrivacyOptions).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows a message when the platform has no privacy options', async () => {
    mockShowAdsPrivacyOptions.mockResolvedValue(false);
    await render(<PrivacyScreen />);
    await pressPrivacyOptionsButton();

    expect(alert).toHaveBeenCalledWith(
      'settings.groups.data.privacy.adsSettings.noOptionsTitle',
      'settings.groups.data.privacy.adsSettings.noOptionsBody',
    );
  });

  it('shows an error message when opening privacy options fails', async () => {
    mockShowAdsPrivacyOptions.mockRejectedValue(new Error('platform unavailable'));
    await render(<PrivacyScreen />);
    await pressPrivacyOptionsButton();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'settings.groups.data.privacy.adsSettings.errorTitle',
        'settings.groups.data.privacy.adsSettings.errorBody',
      ),
    );
  });

  it('ignores a second press while the first request is pending', async () => {
    let resolveOptions!: (opened: boolean) => void;
    mockShowAdsPrivacyOptions.mockImplementation(
      () => new Promise((resolve) => (resolveOptions = resolve)),
    );
    await render(<PrivacyScreen />);
    const button = privacyOptionsButton();

    await act(async () => {
      fireEvent.press(button);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockShowAdsPrivacyOptions).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.press(button);
      await Promise.resolve();
    });
    expect(mockShowAdsPrivacyOptions).toHaveBeenCalledTimes(1);

    resolveOptions(true);
    await act(async () => Promise.resolve());
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeOnTheScreen());
  });
});
