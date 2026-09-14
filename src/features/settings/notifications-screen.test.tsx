import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { NotificationsScreen } from './notifications-screen';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
}));

jest.mock('@/components/layout/screen', () => {
  const { View: MockView, Text: MockText } = jest.requireActual('react-native');

  return {
    Screen: ({ children, title }: { children: ReactNode; title: string }) => (
      <MockView>
        <MockText>{title}</MockText>
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/features/settings/notification-settings-card', () => ({
  NotificationSettingsCard: () => null,
}));

jest.mock('@/features/glp1/components/injection-reminder-settings-card', () => {
  const { Text: MockText } = jest.requireActual('react-native');

  return {
    InjectionReminderSettingsCard: () => <MockText>Injektions-Erinnerung</MockText>,
  };
});

const mockUseSession = jest.mocked(useSession);
const mockUseProfile = jest.mocked(useProfile);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSession.mockReturnValue({
    session: { user: { id: 'user-1' } },
  } as ReturnType<typeof useSession>);
});

describe('NotificationsScreen', () => {
  it('blendet die GLP-1-Injektionserinnerung bei deaktiviertem GLP-1-Tracking aus', async () => {
    mockUseProfile.mockReturnValue({
      data: { tracking_method: 'standard' },
    } as ReturnType<typeof useProfile>);

    await render(<NotificationsScreen />);

    expect(screen.queryByText('Injektions-Erinnerung')).toBeNull();
  });

  it('zeigt die GLP-1-Injektionserinnerung bei aktivem GLP-1-Tracking', async () => {
    mockUseProfile.mockReturnValue({
      data: { tracking_method: 'glp1' },
    } as ReturnType<typeof useProfile>);

    await render(<NotificationsScreen />);

    expect(screen.getByText('Injektions-Erinnerung')).toBeTruthy();
  });
});
