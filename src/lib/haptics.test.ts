const mockStorage = {
  getBoolean: jest.fn((_: string): boolean | undefined => undefined),
  set: jest.fn((_key: string, _value: boolean): void => undefined),
};

const mockHaptics = {
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-haptics', () => mockHaptics);
jest.mock('./storage/device-storage', () => ({
  getDeviceStorage: () => mockStorage,
}));

import { hapticsEnabled, setHapticsEnabled } from './haptics';

describe('haptics preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getBoolean.mockReturnValue(undefined);
  });

  it('is enabled by default when MMKV has no preference', () => {
    expect(hapticsEnabled()).toBe(true);
    expect(mockStorage.getBoolean).toHaveBeenCalledWith('srf:haptics-enabled');
  });

  it('reads the boolean preference directly from MMKV', () => {
    mockStorage.getBoolean.mockReturnValue(false);

    expect(hapticsEnabled()).toBe(false);
  });

  it('persists the preference as a boolean', () => {
    setHapticsEnabled(false);

    expect(mockStorage.set).toHaveBeenCalledWith('srf:haptics-enabled', false);
  });
});
