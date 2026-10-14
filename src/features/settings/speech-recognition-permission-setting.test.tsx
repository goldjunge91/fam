import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { i18n } from '@/i18n';
import { SpeechRecognitionPermissionSetting } from './speech-recognition-permission-setting';

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null;
const mockRequestPermission = jest.fn();

jest.mock('@/features/shopping-list/stt-beta/services/speech-recognizer-permissions', () => ({
  useSpeechRecognizerPermission: () => [mockPermission, mockRequestPermission],
}));

jest.mock('@/features/settings/settings-menu', () => {
  const { Pressable, Text, View } = require('react-native') as typeof import('react-native');

  return {
    SettingsRow: ({
      label,
      hint,
      value,
      onPress,
      disabled,
    }: {
      label: string;
      hint?: string;
      value?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="speech permission setting"
        disabled={disabled}
        onPress={onPress}>
        <View>
          <Text>{label}</Text>
          {hint ? <Text>{hint}</Text> : null}
          {value ? <Text>{value}</Text> : null}
        </View>
      </Pressable>
    ),
  };
});

describe('SpeechRecognitionPermissionSetting', () => {
  beforeEach(async () => {
    mockPermission = null;
    mockRequestPermission.mockReset();
    await i18n.changeLanguage('de');
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows a disabled loading row until permission status is known', async () => {
    await render(<SpeechRecognitionPermissionSetting />);

    expect(screen.getByRole('button', { name: 'speech permission setting' })).toBeDisabled();
    expect(
      screen.getByText(i18n.t('settings.groups.speechToText.permission.status.loading')),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'speech permission setting' }));
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('requests permission when access is denied but can still be asked for', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await render(<SpeechRecognitionPermissionSetting />);

    fireEvent.press(screen.getByRole('button', { name: 'speech permission setting' }));

    expect(
      screen.getByText(i18n.t('settings.groups.speechToText.permission.status.off')),
    ).toBeOnTheScreen();
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ granted: true, canAskAgain: true }, 'settings.groups.speechToText.permission.status.on'],
    [{ granted: false, canAskAgain: false }, 'settings.groups.speechToText.permission.status.off'],
  ] as const)(
    'opens system settings for a completed permission decision',
    async (permission, valueKey) => {
      mockPermission = permission;
      const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
      await render(<SpeechRecognitionPermissionSetting />);

      fireEvent.press(screen.getByRole('button', { name: 'speech permission setting' }));

      expect(screen.getByText(i18n.t(valueKey))).toBeOnTheScreen();
      expect(openSettings).toHaveBeenCalled();
      expect(mockRequestPermission).not.toHaveBeenCalled();
    },
  );
});
