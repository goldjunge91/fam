import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';

const mockRouteParams: Record<string, unknown> = {};
const mockRouterReplace = jest.fn();
const mockRedirect = jest.fn(() => null);
const mockStackScreen = jest.fn(() => null);
const mockStack = Object.assign(
  jest.fn(() => null),
  { Screen: mockStackScreen },
);
const mockHousehold = { activeHouseholdId: null as string | null };
const mockSession = { session: null as unknown, isLoading: true };
const mockAddItemModal = jest.fn(
  (_props: { visible: boolean; householdId: string; onDismiss: () => void }) => null,
);
const mockSiriRequestHandler = jest.fn((_props: { itemParam: string | string[] }) => null);
const mockBrochureViewer = jest.fn((_props: { brochureId: string }) => null);
const mockPlusAndAiScreen = jest.fn((_props: { initialTier: 'ai' | 'plus' }) => null);

jest.doMock('expo-router', () => ({
  Redirect: mockRedirect,
  Stack: mockStack,
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ replace: mockRouterReplace }),
}));

jest.doMock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => mockHousehold,
}));

jest.doMock('@/features/auth/session-provider', () => ({
  useSession: () => mockSession,
}));

jest.doMock('@/features/shopping-list/modals/add-item-modal', () => ({
  AddItemModal: mockAddItemModal,
}));

jest.doMock('@/features/shopping-list/siri/shopping-list-siri-request-handler', () => ({
  ShoppingListSiriRequestHandler: mockSiriRequestHandler,
}));

jest.doMock('@/features/brochures/screens/brochure-viewer-screen', () => ({
  __esModule: true,
  default: mockBrochureViewer,
}));

jest.doMock('@/features/premium/plus-and-ai-screen', () => ({
  PlusAndAiScreen: mockPlusAndAiScreen,
}));

const ShoppingListAddItemRoute = require('../../app/shopping-list-add-item')
  .default as ComponentType;
const BrochureViewerRoute = require('../../app/(app)/brochures/[id]').default as ComponentType;
const HouseholdLayout = require('../../app/household/_layout').default as ComponentType;
const PlusAndAiRoute = require('../../app/settings/plus-and-ai').default as ComponentType;

describe('Expo route wrappers', () => {
  beforeEach(() => {
    mockRouteParams.name = undefined;
    mockRouteParams.id = undefined;
    mockRouteParams.tier = undefined;
    mockRouterReplace.mockClear();
    mockRedirect.mockClear();
    mockStackScreen.mockClear();
    mockStack.mockClear();
    mockHousehold.activeHouseholdId = null;
    mockSession.session = null;
    mockSession.isLoading = true;
    mockAddItemModal.mockClear();
    mockSiriRequestHandler.mockClear();
    mockBrochureViewer.mockClear();
    mockPlusAndAiScreen.mockClear();
  });

  it('routes Siri requests, waits for a household, and dismisses the add-item modal', async () => {
    mockRouteParams.name = 'apples';
    await render(<ShoppingListAddItemRoute />);
    expect(mockSiriRequestHandler).toHaveBeenCalledWith({ itemParam: 'apples' }, undefined);

    mockSiriRequestHandler.mockClear();
    mockRouteParams.name = undefined;
    await render(<ShoppingListAddItemRoute />);
    expect(mockAddItemModal).not.toHaveBeenCalled();

    mockHousehold.activeHouseholdId = 'household-1';
    await render(<ShoppingListAddItemRoute />);
    expect(mockAddItemModal).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, householdId: 'household-1' }),
      undefined,
    );
    const modalProps = mockAddItemModal.mock.calls.at(-1)?.[0];
    modalProps?.onDismiss();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/shopping-list');
  });

  it('renders the brochure viewer only when the route has an id', async () => {
    await render(<BrochureViewerRoute />);
    expect(mockBrochureViewer).not.toHaveBeenCalled();

    mockRouteParams.id = 'brochure-1';
    await render(<BrochureViewerRoute />);
    expect(mockStackScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { headerShown: false, presentation: 'fullScreenModal' },
      }),
      undefined,
    );
    expect(mockBrochureViewer).toHaveBeenCalledWith({ brochureId: 'brochure-1' }, undefined);
  });

  it('waits for session loading, redirects signed-out users, and shows the household stack', async () => {
    await render(<HouseholdLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockStack).not.toHaveBeenCalled();

    mockSession.isLoading = false;
    await render(<HouseholdLayout />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/onboarding' }, undefined);

    mockSession.session = { user: { id: 'account-1' } };
    await render(<HouseholdLayout />);
    expect(mockStack).toHaveBeenCalledWith(
      expect.objectContaining({ screenOptions: { headerShown: false } }),
      undefined,
    );
  });

  it('selects the requested premium tier and defaults to plus', async () => {
    mockRouteParams.tier = 'ai';
    await render(<PlusAndAiRoute />);
    expect(mockPlusAndAiScreen).toHaveBeenCalledWith({ initialTier: 'ai' }, undefined);

    mockRouteParams.tier = 'unknown';
    await render(<PlusAndAiRoute />);
    expect(mockPlusAndAiScreen).toHaveBeenLastCalledWith({ initialTier: 'plus' }, undefined);
  });
});
