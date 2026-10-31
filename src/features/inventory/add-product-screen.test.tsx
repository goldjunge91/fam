import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddProductScreen } from '@/features/inventory/add-product-screen';
import { consumePendingProductSelection } from '@/features/inventory/pending-product-selection';

let mockParams: Record<string, string> = {};
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };

const mockAddProductMutateAsync = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
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
  mockSession = { user: { id: 'user-1' } };
  mockAddProductMutateAsync.mockReset();
  consumePendingProductSelection(); // Puffer zwischen Tests leeren.
});

afterEach(() => jest.restoreAllMocks());

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

  it('normalisiert optionale Nährwerte und lässt ungültige Werte aus', async () => {
    mockAddProductMutateAsync.mockResolvedValue({
      id: 'prod-2',
      name: 'Haferdrink',
      barcode: '123',
      brand: 'Bio',
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), ' Haferdrink ');
    await fireEvent.changeText(screen.getByLabelText('Marke (optional)'), ' Bio ');
    await fireEvent.changeText(screen.getByLabelText('kcal pro 100g'), '42.5 kcal');
    await fireEvent.changeText(screen.getByLabelText('Kohlenhydrate pro 100g'), 'ungültig');
    await fireEvent.changeText(screen.getByLabelText('Eiweiß pro 100g'), '1.2');
    await fireEvent.changeText(screen.getByLabelText('Fett pro 100g'), ' ');
    await fireEvent.changeText(screen.getByLabelText('Portionsgröße in Gramm (optional)'), '30');

    await fireEvent.press(screen.getByText('Speichern'));

    expect(mockAddProductMutateAsync).toHaveBeenCalledWith({
      name: 'Haferdrink',
      brand: 'Bio',
      kcal_per_100: 42.5,
      protein_g_per_100: 1.2,
      carbs_g_per_100: undefined,
      fat_g_per_100: undefined,
      serving_size_g: 30,
      source: 'manual',
      created_by: 'user-1',
    });
  });

  it('zeigt einen Speicherfehler an', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAddProductMutateAsync.mockRejectedValueOnce(new Error('offline'));
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Haferdrink');
    await fireEvent.press(screen.getByText('Speichern'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Fehler', 'offline'));
  });

  it('speichert nicht ohne angemeldete Person', async () => {
    mockSession = null;
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Haferdrink');
    await fireEvent.press(screen.getByText('Speichern'));
    expect(mockAddProductMutateAsync).not.toHaveBeenCalled();
  });
});
