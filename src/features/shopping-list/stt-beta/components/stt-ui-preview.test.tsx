import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import type { TextBetaPreview } from '../workflow/text-workflow';

jest.mock('@expo/ui/community/bottom-sheet', () => {
  const { Pressable, Text, View } = require('react-native');
  const BottomSheet = ({
    children,
    index,
    onClose,
    onDismiss,
  }: {
    children: React.ReactNode;
    index: number;
    onClose: () => void;
    onDismiss: () => void;
  }) => (
    <View>
      <Text>{`sheet-index:${index}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close host" onPress={onClose} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss host" onPress={onDismiss} />
      {children}
    </View>
  );
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@expo/ui', () => {
  const { View } = require('react-native');
  return { Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@expo/ui/swift-ui', () => {
  const { Pressable, Text, View } = require('react-native');
  const Wrapper = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  return {
    BottomSheet: ({
      children,
      isPresented,
      onIsPresentedChange,
      onDismiss,
    }: {
      children: React.ReactNode;
      isPresented: boolean;
      onIsPresentedChange: (presented: boolean) => void;
      onDismiss: () => void;
    }) => (
      <View>
        <Text>{`ios-presented:${isPresented}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep iOS host open"
          onPress={() => onIsPresentedChange(true)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close iOS host"
          onPress={() => onIsPresentedChange(false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss iOS host"
          onPress={onDismiss}
        />
        {children}
      </View>
    ),
    Group: Wrapper,
    RNHostView: Wrapper,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  frame: jest.fn(),
  presentationBackground: jest.fn(),
  presentationDetents: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

const { NaturalLanguageAdditionSwiftUIPreview: FallbackPreview } = jest.requireActual(
  './stt-ui-preview.tsx',
) as typeof import('./stt-ui-preview');
const { NaturalLanguageAdditionSwiftUIPreview: IOSPreview } = jest.requireActual(
  './stt-ui-preview.ios.tsx',
) as typeof import('./stt-ui-preview.ios');

const preview: TextBetaPreview = {
  session: { id: 'session-1', source: 'text', startedAt: '2026-10-11T00:00:00.000Z' },
  input: { source: 'text', text: '', locale: null },
  parseResult: { items: [], unparsedText: null },
  items: [],
  learningProgress: { uniqueAssignments: 0, thresholdReached: false },
};

describe('NaturalLanguageAdditionSwiftUIPreview', () => {
  it('binds presentation to visibility and forwards close and dismiss callbacks', async () => {
    const onRequestClose = jest.fn();
    const onDismiss = jest.fn();
    await render(
      <FallbackPreview
        visible
        preview={preview}
        onRequestClose={onRequestClose}
        onDismiss={onDismiss}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByText('sheet-index:0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close host' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss host' }));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Passt das so?')).toBeOnTheScreen();
  });

  it('uses the hidden index when the preview is closed', async () => {
    await render(
      <FallbackPreview
        visible={false}
        preview={preview}
        onRequestClose={jest.fn()}
        onDismiss={jest.fn()}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByText('sheet-index:-1')).toBeOnTheScreen();
  });

  it('presents the native iOS sheet and forwards its close and dismiss events', async () => {
    const onRequestClose = jest.fn();
    const onDismiss = jest.fn();
    await render(
      <IOSPreview
        visible
        preview={preview}
        onRequestClose={onRequestClose}
        onDismiss={onDismiss}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByText('ios-presented:true')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep iOS host open' }));
    expect(onRequestClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Close iOS host' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss iOS host' }));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
