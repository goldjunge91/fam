import { debugLog } from '@/lib/observability/debug-log';
import { logRecipeImageLoaded } from './recipe-preview-card';

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: jest.fn(),
  debugLog: jest.fn(),
}));

const mockDebugLog = jest.mocked(debugLog);

describe('RecipeCover image logging', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockDebugLog.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('fasst mehrere Ladevorgänge zu einer Summary zusammen', () => {
    logRecipeImageLoaded({ title: 'Overnight Oats', cacheType: 'none' });
    logRecipeImageLoaded({ title: 'Rührei mit Gouda', cacheType: 'none' });
    logRecipeImageLoaded({ title: 'Rührei mit Gouda', cacheType: 'none' });

    expect(mockDebugLog).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);

    expect(mockDebugLog).toHaveBeenCalledTimes(1);
    expect(mockDebugLog).toHaveBeenCalledWith('[RecipeCover] images:loaded', {
      count: 3,
      uniqueTitles: 2,
      titles: { 'Overnight Oats': 1, 'Rührei mit Gouda': 2 },
      cacheTypes: { none: 3 },
    });
  });
});
