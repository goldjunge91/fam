import type { ImpactFeedbackStyle } from 'expo-haptics';

const mockStorage = {
  getBoolean: jest.fn((_: string): boolean | undefined => undefined),
  set: jest.fn((_key: string, _value: boolean): void => undefined),
};

jest.mock('expo-haptics', () => ({
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
}));
jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => mockStorage,
}));

const mockHaptics = jest.requireMock<{
  ImpactFeedbackStyle: {
    Light: string;
    Medium: string;
    Heavy: string;
    Soft: string;
    Rigid: string;
  };
  NotificationFeedbackType: {
    Success: string;
    Warning: string;
    Error: string;
  };
  impactAsync: jest.Mock;
  selectionAsync: jest.Mock;
  notificationAsync: jest.Mock;
}>('expo-haptics');

import {
  error,
  haptics,
  hapticsEnabled,
  heavy,
  light,
  medium,
  rigid,
  selection,
  setHapticsEnabled,
  soft,
  success,
  tap,
  warning,
} from './haptics';

describe('haptics preference', () => {
  beforeEach(() => {
    mockStorage.getBoolean.mockReset().mockReturnValue(undefined);
    mockStorage.set.mockReset();
    mockHaptics.impactAsync.mockReset().mockResolvedValue(undefined);
    mockHaptics.selectionAsync.mockReset().mockResolvedValue(undefined);
    mockHaptics.notificationAsync.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('maps tap and intent helpers to their corresponding feedback styles', () => {
    tap();
    tap(mockHaptics.ImpactFeedbackStyle.Heavy as ImpactFeedbackStyle);
    light();
    medium();
    heavy();
    soft();
    rigid();
    selection();
    success();
    warning();
    error();

    expect(mockHaptics.impactAsync.mock.calls.map(([style]) => style)).toEqual([
      'light',
      'heavy',
      'light',
      'medium',
      'heavy',
      'soft',
      'rigid',
    ]);
    expect(mockHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(mockHaptics.notificationAsync.mock.calls.map(([type]) => type)).toEqual([
      'success',
      'warning',
      'error',
    ]);
    expect(haptics.tap).toBe(tap);
  });

  it('skips every feedback helper when the preference is disabled', () => {
    mockStorage.getBoolean.mockReturnValue(false);

    haptics.tap();
    haptics.light();
    haptics.medium();
    haptics.heavy();
    haptics.soft();
    haptics.rigid();
    haptics.selection();
    haptics.success();
    haptics.warning();
    haptics.error();
    haptics.celebrate();

    expect(mockHaptics.impactAsync).not.toHaveBeenCalled();
    expect(mockHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(mockHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('falls back safely when storage is unavailable and sequences celebration feedback', () => {
    jest.useFakeTimers();
    mockStorage.getBoolean.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    mockStorage.set.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(hapticsEnabled()).toBe(true);
    expect(() => setHapticsEnabled(false)).not.toThrow();
    haptics.celebrate();
    expect(mockHaptics.impactAsync).toHaveBeenCalledWith('rigid');

    jest.advanceTimersByTime(300);

    expect(mockHaptics.impactAsync.mock.calls.map(([style]) => style)).toEqual([
      'rigid',
      'medium',
      'heavy',
    ]);
    expect(mockHaptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('swallows rejected native feedback promises', async () => {
    mockHaptics.impactAsync.mockRejectedValue(new Error('no haptic engine'));
    mockHaptics.selectionAsync.mockRejectedValue(new Error('no haptic engine'));
    mockHaptics.notificationAsync.mockRejectedValue(new Error('no haptic engine'));

    tap();
    selection();
    success();
    await Promise.resolve();

    expect(mockHaptics.impactAsync).toHaveBeenCalled();
    expect(mockHaptics.selectionAsync).toHaveBeenCalled();
    expect(mockHaptics.notificationAsync).toHaveBeenCalled();
  });
});
