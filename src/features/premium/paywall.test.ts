const mockPresentCustomerCenter = jest.fn<Promise<void>, []>();
const mockIsPurchasesConfigured = jest.fn<boolean, []>();
let platformOS = 'ios';

jest.doMock('react-native', () => ({
  Platform: {
    get OS() {
      return platformOS;
    },
  },
}));

jest.doMock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentCustomerCenter: mockPresentCustomerCenter },
}));

jest.doMock('@/lib/backend/revenuecat', () => ({
  isPurchasesConfigured: mockIsPurchasesConfigured,
}));

const { presentCustomerCenter } = require('./paywall') as typeof import('./paywall');

describe('RevenueCat Customer Center entry', () => {
  beforeEach(() => {
    platformOS = 'ios';
    mockPresentCustomerCenter.mockReset().mockResolvedValue(undefined);
    mockIsPurchasesConfigured.mockReset().mockReturnValue(true);
  });

  it('skips the UI on web and when the native purchases SDK is unavailable', async () => {
    platformOS = 'web';
    await expect(presentCustomerCenter()).resolves.toBeUndefined();
    expect(mockIsPurchasesConfigured).not.toHaveBeenCalled();
    expect(mockPresentCustomerCenter).not.toHaveBeenCalled();

    platformOS = 'android';
    mockIsPurchasesConfigured.mockReturnValue(false);
    await expect(presentCustomerCenter()).resolves.toBeUndefined();
    expect(mockIsPurchasesConfigured).toHaveBeenCalledTimes(1);
    expect(mockPresentCustomerCenter).not.toHaveBeenCalled();
  });

  it('presents the Customer Center on iOS and Android when configured', async () => {
    await presentCustomerCenter();
    platformOS = 'android';
    await presentCustomerCenter();

    expect(mockPresentCustomerCenter).toHaveBeenCalledTimes(2);
  });
});
