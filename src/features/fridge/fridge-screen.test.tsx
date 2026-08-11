import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FridgeScreen } from '@/features/fridge/fridge-screen';

const mockUpdateQtyMutate = jest.fn();
const mockRestoreMutate = jest.fn();
const mockShowUndoSnackbar = jest.fn();

let mockItems: unknown[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [] }),
}));

jest.mock('@/features/fridge/use-fridge-items', () => ({
  useFridgeItems: () => ({ data: mockItems, isLoading: false }),
}));

jest.mock('@/features/fridge/use-fridge-mutations', () => ({
  useUpdateFridgeItemQuantityMutation: () => ({ mutate: mockUpdateQtyMutate, isPending: false }),
  useRestoreFridgeItemMutation: () => ({ mutate: mockRestoreMutate, isPending: false }),
}));

jest.mock('@/components/snackbar', () => ({
  useSnackbar: () => ({ showUndoSnackbar: mockShowUndoSnackbar }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    text: '#000000',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <FridgeScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockItems = [
    {
      id: 'item-1',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 2,
      unit: 'l',
      expiry_date: null,
      added_by: null,
      created_at: '',
      location_kind: null,
      location_name: null,
    },
  ];
  mockUpdateQtyMutate.mockClear();
  mockRestoreMutate.mockClear();
  mockShowUndoSnackbar.mockClear();
});

it('loescht einen Artikel bei Lang-Druck sofort und zeigt eine Undo-Snackbar (#69)', async () => {
  await renderScreen();

  await fireEvent(screen.getByLabelText('Milch, 2 l'), 'longPress');

  expect(mockUpdateQtyMutate).toHaveBeenCalledWith({
    id: 'item-1',
    household_id: 'hh-1',
    delta: -2,
  });
  expect(mockShowUndoSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ message: '"Milch" gelöscht', onUndo: expect.any(Function) }),
  );

  const { onUndo } = mockShowUndoSnackbar.mock.calls[0][0];
  onUndo();
  expect(mockRestoreMutate).toHaveBeenCalledWith({ id: 'item-1', household_id: 'hh-1' });
});
