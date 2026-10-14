import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Alert } from 'react-native';
import { buildUserDataExport, type UserDataExport } from './data-export';
import { ExportScreen } from './export-screen';

let mockSession: { user: { id: string } } | null = null;
let mockFileExists = true;
let mockLastFile: {
  exists: boolean;
  uri: string;
  delete: jest.MockedFunction<() => void>;
  write: jest.MockedFunction<(contents: string) => void>;
} | null = null;

const exportData: UserDataExport = {
  exportedAt: '2026-10-11T00:00:00.000Z',
  format: 'fam-user-export-v1',
  profile: null,
  goals: [],
  foodEntries: [],
  weightEntries: [],
  childProfiles: [],
  householdMemberships: [],
};

jest.mock('expo-file-system', () => {
  class MockFile {
    exists = mockFileExists;
    uri: string;
    delete = jest.fn();
    write = jest.fn();

    constructor(_directory: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
      mockLastFile = this;
    }
  }
  return { File: MockFile, Paths: { cache: 'file:///cache' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { path?: string }) =>
      options?.path ? `${key}:${options.path}` : key,
  }),
}));

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ContentCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      loading,
    }: {
      title: string;
      onPress: () => void;
      loading?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityState: { busy: loading },
          onPress: () => {
            void onPress();
          },
        },
        React.createElement(Text, null, loading ? `${title}…` : title),
      ),
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/settings/data-export', () => ({
  buildUserDataExport: jest.fn(),
}));

describe('ExportScreen', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'user-1' } };
    mockFileExists = true;
    mockLastFile = null;
    jest.mocked(buildUserDataExport).mockReset();
    jest.mocked(isAvailableAsync).mockReset();
    jest.mocked(shareAsync).mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing without a signed-in user', async () => {
    mockSession = null;
    await render(<ExportScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' }),
    );

    expect(buildUserDataExport).not.toHaveBeenCalled();
  });

  it('writes the export file and shares it when sharing is available', async () => {
    jest.mocked(buildUserDataExport).mockResolvedValue(exportData);
    jest.mocked(isAvailableAsync).mockResolvedValue(true);
    jest.mocked(shareAsync).mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ExportScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' }),
    );

    await waitFor(() => expect(shareAsync).toHaveBeenCalled());
    expect(buildUserDataExport).toHaveBeenCalledWith('user-1');
    expect(mockLastFile).not.toBeNull();
    expect(mockLastFile?.delete).toHaveBeenCalledTimes(1);
    expect(mockLastFile?.write).toHaveBeenCalledWith(JSON.stringify(exportData, null, 2));
    expect(shareAsync).toHaveBeenCalledWith(
      mockLastFile?.uri,
      expect.objectContaining({
        mimeType: 'application/json',
        dialogTitle: 'settings.groups.data.export.shareDialogTitle',
      }),
    );
    expect(alert).not.toHaveBeenCalled();
  });

  it('reports the saved file path and preserves an already-absent file', async () => {
    mockFileExists = false;
    jest.mocked(buildUserDataExport).mockResolvedValue(exportData);
    jest.mocked(isAvailableAsync).mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ExportScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' }),
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'settings.groups.data.export.createdTitle',
        `settings.groups.data.export.createdBody:${mockLastFile?.uri}`,
      ),
    );
    expect(shareAsync).not.toHaveBeenCalled();
    expect(mockLastFile?.delete).not.toHaveBeenCalled();
  });

  it('shows export errors and clears the loading state', async () => {
    jest.mocked(buildUserDataExport).mockRejectedValue(new Error('database unavailable'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ExportScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' }),
    );

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'settings.groups.data.export.failedTitle',
        'database unavailable',
      ),
    );
    expect(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' }),
    ).toBeOnTheScreen();
  });

  it('ignores a repeated press while an export is already running', async () => {
    let finishExport: ((value: UserDataExport) => void) | undefined;
    jest.mocked(buildUserDataExport).mockReturnValue(
      new Promise<UserDataExport>((resolve) => {
        finishExport = resolve;
      }),
    );
    jest.mocked(isAvailableAsync).mockResolvedValue(false);
    await render(<ExportScreen />);
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'settings.groups.data.export.exportButton' });

    await user.press(button);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'settings.groups.data.export.exportButton…' }),
      ).toBeOnTheScreen(),
    );
    await user.press(
      screen.getByRole('button', { name: 'settings.groups.data.export.exportButton…' }),
    );
    expect(buildUserDataExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishExport?.(exportData);
      await Promise.resolve();
    });
    await waitFor(() => expect(isAvailableAsync).toHaveBeenCalled());
  });
});
