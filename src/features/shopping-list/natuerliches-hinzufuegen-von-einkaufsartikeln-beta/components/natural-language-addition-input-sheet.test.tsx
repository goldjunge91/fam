import { render, screen } from '@testing-library/react-native';

import { NaturalLanguageAdditionInputSheet } from './natural-language-addition-input-sheet';

jest.mock('@expo/ui', () => {
  const React = require('react');
  const { View: MockView } = require('react-native');

  return {
    BottomSheet: ({
      children,
      isPresented,
      ...props
    }: {
      children: React.ReactNode;
      isPresented: boolean;
    }) => (isPresented ? <MockView {...props}>{children}</MockView> : null),
    Host: ({ children, ...props }: { children: React.ReactNode }) => (
      <MockView {...props}>{children}</MockView>
    ),
  };
});

jest.mock('../services/native-speech-recognition', () => ({
  nativeSpeechRecognitionAdapter: { start: jest.fn() },
}));

describe('NaturalLanguageAdditionInputSheet', () => {
  it('uses expandable sheet detents and a keyboard-aware scroll container', async () => {
    await render(
      <NaturalLanguageAdditionInputSheet visible onDismiss={jest.fn()} onSubmit={jest.fn()} />,
    );

    expect(screen.getByTestId('natural-language-addition-input-sheet')).toHaveProp('snapPoints', [
      'half',
      'full',
    ]);
    expect(screen.getByTestId('natural-language-addition-input-scroll')).toHaveProp(
      'keyboardDismissMode',
      'interactive',
    );
    expect(screen.getByTestId('natural-language-addition-input-scroll')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveStyle({
      alignItems: 'center',
      justifyContent: 'center',
    });
  });
});
