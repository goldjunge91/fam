import { render, screen } from '@testing-library/react-native';

const { SwiftUIBottomSheetDemo } = jest.requireActual<{
  SwiftUIBottomSheetDemo: typeof import('./showcase-modal-swift-ui').SwiftUIBottomSheetDemo;
}>('./showcase-modal-swift-ui.tsx');

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { backgroundSoft: '#f7f2ee' } }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

describe('generic SwiftUI bottom sheet fallback', () => {
  it('explains that the native demo is unavailable on this platform', async () => {
    await render(<SwiftUIBottomSheetDemo />);

    expect(screen.getByText('SwiftUI-BottomSheet nur auf iOS verfügbar.')).toBeOnTheScreen();
  });
});
