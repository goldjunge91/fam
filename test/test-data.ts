export const MIN_TEST_VALUE = 1_000;
export const MAX_TEST_VALUE = 10_000;

type RandomIntegerOptions = {
  min?: number;
  max?: number;
  random?: () => number;
};

/** Erstellt eine frische Testdatenzeile und erlaubt punktuelle Overrides. */
export function createTestData<T extends object>(base: T, overrides: Partial<T> = {}): T {
  return { ...base, ...overrides };
}

/**
 * Liefert eine inklusive Ganzzahl aus einem Bereich. Der Zufallsgeber ist
 * injizierbar, damit Tests ihre Werte reproduzierbar festlegen können.
 */
export function randomInteger({
  min = MIN_TEST_VALUE,
  max = MAX_TEST_VALUE,
  random = Math.random,
}: RandomIntegerOptions = {}): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new Error('min und max müssen sichere Ganzzahlen sein.');
  }
  if (min > max) {
    throw new Error('min muss kleiner oder gleich max sein.');
  }

  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Zufallswert muss im Bereich [0, 1) liegen.');
  }

  return min + Math.floor(value * (max - min + 1));
}