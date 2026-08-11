import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddProductScreen } from '@/features/inventory/add-product-screen';
import { consumePendingProductSelection } from '@/features/inventory/pending-product-selection';

let mockParams: Record<string, string> = {};

const mockAddProductMutateAsync = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: mockAddProductMutateAsync, isPending: false }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <AddProductScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockParams = {};
  mockAddProductMutateAsync.mockReset();
  consumePendingProductSelection(); // Puffer zwischen Tests leeren.
});

describe('AddProductScreen', () => {
  it('startet mit einem leeren Formular, sofern kein prefillName-Param gesetzt ist', async () => {
    await renderScreen();
    expect(screen.getByPlaceholderText('z. B. Tomaten (lose)').props.value).toBe('');
  });

  it('uebernimmt prefillName aus den Route-Params in das Namensfeld', async () => {
    mockParams = { prefillName: 'Bio-Karotten' };
    await renderScreen();
    expect(screen.getByDisplayValue('Bio-Karotten')).toBeTruthy();
  });

  it('legt beim Speichern ein manuelles Produkt an und macht es fuer die aufrufende Stelle verfuegbar', async () => {
    mockAddProductMutateAsync.mockResolvedValue({
      id: 'prod-1',
      barcode: null,
      name: 'Bio-Karotten',
      brand: null,
      kcal_per_100: 41,
      protein_g_per_100: 0.9,
      carbs_g_per_100: 10,
      fat_g_per_100: 0.2,
    });

    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('z. B. Tomaten (lose)'), 'Bio-Karotten');
    await fireEvent.press(screen.getByText('Speichern'));

    expect(mockAddProductMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bio-Karotten', source: 'manual', created_by: 'user-1' }),
    );
    expect(router.back).toHaveBeenCalled();
    expect(consumePendingProductSelection()).toEqual(
      expect.objectContaining({ name: 'Bio-Karotten', caloriesPer100g: 41 }),
    );
  });
});
