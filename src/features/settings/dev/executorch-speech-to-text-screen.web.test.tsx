import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ExecuTorchSpeechToTextScreen } from './executorch-speech-to-text-screen.web';

jest.mock('@/components/layout/screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Screen: ({
      title,
      subtitle,
      children,
    }: {
      title: string;
      subtitle: string;
      children: ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, title),
        React.createElement(Text, null, subtitle),
        children,
      ),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    ContentCard: ({ title, children }: { title: string; children: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Txt: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
  };
});

it('explains why local ExecuTorch transcription is unavailable on web', async () => {
  await render(<ExecuTorchSpeechToTextScreen />);

  expect(screen.getByText('ExecuTorch Speech-to-Text')).toBeOnTheScreen();
  expect(screen.getByText('Auf dieser Plattform nicht verfügbar')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'ExecuTorch und die lokale Mikrofonaufnahme benötigen die nativen iOS- oder Android-Module.',
    ),
  ).toBeOnTheScreen();
});
