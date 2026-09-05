import { logRecipeImageLoaded } from './recipe-preview-card';

describe('RecipeCover image logging', () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.useFakeTimers();
    consoleLog.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('fasst mehrere Ladevorgänge zu einer Summary zusammen', () => {
    logRecipeImageLoaded({ title: 'Overnight Oats', cacheType: 'none' });
    logRecipeImageLoaded({ title: 'Rührei mit Gouda', cacheType: 'none' });
    logRecipeImageLoaded({ title: 'Rührei mit Gouda', cacheType: 'none' });

    expect(consoleLog).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);

    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(consoleLog).toHaveBeenCalledWith('[RecipeCover] images:loaded', {
      count: 3,
      uniqueTitles: 2,
      titles: {
        'Overnight Oats': 1,
        'Rührei mit Gouda': 2,
      },
      cacheTypes: { none: 3 },
    });
  });
});
