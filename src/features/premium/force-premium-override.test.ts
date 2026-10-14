import { useForceAiOverrideStore, useForcePremiumOverrideStore } from './force-premium-override';

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => (key === 'dev.force_premium_override' ? 'true' : 'false'),
    set: jest.fn(),
    remove: jest.fn(),
  }),
}));

describe('development override stores', () => {
  it('loads stored boolean values and persists changes or clears them', () => {
    expect(useForcePremiumOverrideStore.getState().override).toBe(true);
    expect(useForceAiOverrideStore.getState().override).toBe(false);

    useForcePremiumOverrideStore.getState().setOverride(false);
    expect(useForcePremiumOverrideStore.getState().override).toBe(false);
    useForcePremiumOverrideStore.getState().setOverride(null);
    expect(useForcePremiumOverrideStore.getState().override).toBeNull();

    useForceAiOverrideStore.getState().setOverride(true);
    expect(useForceAiOverrideStore.getState().override).toBe(true);
    useForceAiOverrideStore.getState().setOverride(null);
    expect(useForceAiOverrideStore.getState().override).toBeNull();
  });
});
