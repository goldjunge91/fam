import { celebrate, subscribeToCelebrations } from './celebration';
import { celebrate as hapticCelebrate } from './haptics';

jest.mock('./haptics', () => ({
  celebrate: jest.fn(),
}));

describe('celebration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sendet den Burst an den Host und löst Haptik aus', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToCelebrations(listener);

    celebrate('🔥 7 Tage Streak!');

    expect(hapticCelebrate).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(Number), message: '🔥 7 Tage Streak!' }),
    );
    unsubscribe();
  });

  it('lässt die sichtbare Celebration trotz Haptik-Fehler zu', () => {
    jest.mocked(hapticCelebrate).mockImplementation(() => {
      throw new Error('Haptik nicht verfügbar');
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToCelebrations(listener);

    expect(() => celebrate()).not.toThrow();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: undefined }));
    unsubscribe();
  });
});
