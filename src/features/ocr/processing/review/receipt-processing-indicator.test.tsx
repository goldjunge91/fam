import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ReceiptProcessingIndicator } from './receipt-processing-indicator';

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

it('shows the progress indicator and cancels its scan loop when unmounted', async () => {
  const view = await render(<ReceiptProcessingIndicator label="Bon wird geprüft" />);

  expect(screen.getByTestId('receipt-processing-animation')).toBeOnTheScreen();
  await view.unmount();
});

it('keeps the progress label available when reduced motion is enabled', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);

  await render(<ReceiptProcessingIndicator label="Bon wird geprüft" />);

  expect(useReducedMotion).toHaveReturnedWith(true);
  expect(screen.getByTestId('receipt-processing-animation')).toHaveProp(
    'accessibilityLabel',
    'Bon wird geprüft',
  );
});
