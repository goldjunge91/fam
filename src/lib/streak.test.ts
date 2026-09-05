const mockStorage = {
  getString: jest.fn((_key: string): string | undefined => undefined),
  set: jest.fn((_key: string, _value: string): void => undefined),
  addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('./storage/device-storage', () => ({
  getDeviceStorage: () => mockStorage,
}));

import { getStreak, recordActivity } from './streak';

describe('streak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getString.mockReturnValue(undefined);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-04T12:00:00+02:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts empty when no activity has been recorded', () => {
    expect(getStreak()).toEqual({ count: 0, best: 0, activeToday: false });
  });

  it('records the first activity and persists the streak', () => {
    expect(recordActivity()).toEqual({ count: 1, increased: true, milestone: false });
    expect(mockStorage.set).toHaveBeenCalledWith(
      'srf:cook-streak',
      JSON.stringify({ count: 1, lastDate: '2026-09-04', best: 1 }),
    );
  });

  it('does not count multiple activities on the same day twice', () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify({ count: 3, lastDate: '2026-09-04', best: 3 }),
    );

    expect(recordActivity()).toEqual({ count: 3, increased: false, milestone: false });
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('continues on the next day and recognizes milestones', () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify({ count: 2, lastDate: '2026-09-03', best: 2 }),
    );

    expect(recordActivity()).toEqual({ count: 3, increased: true, milestone: true });
  });

  it('resets after a gap while preserving the best streak', () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify({ count: 7, lastDate: '2026-09-01', best: 7 }),
    );

    expect(recordActivity()).toEqual({ count: 1, increased: true, milestone: false });
    expect(mockStorage.set).toHaveBeenCalledWith(
      'srf:cook-streak',
      JSON.stringify({ count: 1, lastDate: '2026-09-04', best: 7 }),
    );
  });

  it('does not treat a future-dated activity as an active streak', () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify({ count: 4, lastDate: '2026-09-05', best: 4 }),
    );

    expect(getStreak()).toEqual({ count: 0, best: 4, activeToday: false });
  });
});
