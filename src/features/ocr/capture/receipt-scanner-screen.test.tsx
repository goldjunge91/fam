import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReceiptScannerScreen } from './receipt-scanner-screen';

const mockSetFlowVisible = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/ocr/processing/review/receipt-capture-review-flow', () => ({
  ReceiptCaptureReviewFlow: ({ visible }: { visible: boolean }) => {
    mockSetFlowVisible(visible);
    return null;
  },
}));

describe('ReceiptScannerScreen', () => {
  it('opens the existing receipt capture flow from the scanner actions', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Beleg aufnehmen' }));

    expect(mockSetFlowVisible).toHaveBeenLastCalledWith(true);
  });
});
