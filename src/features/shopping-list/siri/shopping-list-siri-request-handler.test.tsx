import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ShoppingListSiriRequestHandler } from '@/features/shopping-list/siri/shopping-list-siri-request-handler';

const mockReplace = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const mockMutateAsync = jest.fn();
const mockSessionState: { isLoading: boolean; session: { user: { id: string } } | null } = {
  isLoading: false,
  session: { user: { id: 'user-1' } },
};
const mockHouseholdState: { activeHouseholdId: string | null } = { activeHouseholdId: 'hh-1' };
const mockHouseholdsState: { isLoading: boolean; isError: boolean } = {
  isLoading: false,
  isError: false,
};

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/features/auth/session-provider', () => ({ useSession: () => mockSessionState }));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => mockHouseholdState,
}));
jest.mock('@/features/household/api', () => ({ useHouseholds: () => mockHouseholdsState }));
jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: mockMutateAsync }),
}));

describe('ShoppingListSiriRequestHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState.isLoading = false;
    mockSessionState.session = { user: { id: 'user-1' } };
    mockHouseholdState.activeHouseholdId = 'hh-1';
    mockHouseholdsState.isLoading = false;
    mockHouseholdsState.isError = false;
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it('waits for session and household loading to finish', async () => {
    mockSessionState.isLoading = true;
    mockHouseholdsState.isLoading = true;

    await render(<ShoppingListSiriRequestHandler itemParam="Hafermilch" />);

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows an invalid-item alert once and returns to the shopping list on dismissal', async () => {
    await render(<ShoppingListSiriRequestHandler itemParam={['', 'Hafermilch']} />);

    expect(mockAlert).toHaveBeenCalledWith(
      'shoppingList.siriAdd.invalidItemTitle',
      'shoppingList.siriAdd.invalidItemBody',
      expect.any(Array),
    );
    await render(<ShoppingListSiriRequestHandler itemParam="Hafermilch" />);
    expect(mockAlert).toHaveBeenCalledTimes(1);

    const actions = mockAlert.mock.calls[0]?.[2];
    actions?.[0]?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/shopping-list');
  });

  it.each([
    ['signed out', null, 'hh-1', false],
    ['household query error', { user: { id: 'user-1' } }, 'hh-1', true],
    ['no active household', { user: { id: 'user-1' } }, null, false],
  ])('reports missing household access when %s', async (_name, session, householdId, isError) => {
    mockSessionState.session = session;
    mockHouseholdState.activeHouseholdId = householdId;
    mockHouseholdsState.isError = isError;

    await render(<ShoppingListSiriRequestHandler itemParam="Hafermilch" />);

    expect(mockAlert).toHaveBeenCalledWith(
      'shoppingList.siriAdd.noHouseholdTitle',
      'shoppingList.siriAdd.noHouseholdBody',
      expect.any(Array),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('adds a parsed item and returns to the shopping list', async () => {
    await render(<ShoppingListSiriRequestHandler itemParam="  Hafermilch  " />);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'hh-1', name: 'Hafermilch', quantity: 1 }),
    );
    await Promise.resolve();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/shopping-list');
  });

  it('shows a save error and returns after dismissal when adding fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('offline'));

    await render(<ShoppingListSiriRequestHandler itemParam="Hafermilch" />);
    await Promise.resolve();

    expect(mockAlert).toHaveBeenCalledWith(
      'shoppingList.siriAdd.saveErrorTitle',
      'shoppingList.siriAdd.saveErrorBody',
      expect.any(Array),
    );
    const actions = mockAlert.mock.calls[0]?.[2];
    actions?.[0]?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/shopping-list');
  });
});
