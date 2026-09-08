import {
    createTestData,
    MAX_TEST_VALUE,
    MIN_TEST_VALUE,
    randomInteger,
} from './test-data';

describe('test data helpers', () => {
    it('merges per-test overrides into one shared data shape', () => {
        const base = {
            name: 'example',
            count: 3,
        };

        expect(createTestData(base, { count: 4 })).toEqual({
            ...base,
            count: 4,
        });
    });

    it.each([
        ['MIN', MIN_TEST_VALUE],
        ['MIN + 1', MIN_TEST_VALUE + 1],
        ['-1', -1],
        ['0', 0],
        ['1', 1],
        ['MAX - 1', MAX_TEST_VALUE - 1],
        ['MAX', MAX_TEST_VALUE],
    ])('returns the configured integer boundary %s', (_label, boundary) => {
        expect(randomInteger({ min: boundary, max: boundary, random: () => 0 })).toBe(boundary);
    });

    it('returns the inclusive upper bound for an injected random value', () => {
        expect(
            randomInteger({ min: MIN_TEST_VALUE, max: MAX_TEST_VALUE, random: () => 0.999999 }),
        ).toBe(MAX_TEST_VALUE);
    });

    it.each([
        ['MAX + 1 as lower bound', MAX_TEST_VALUE + 1, MAX_TEST_VALUE],
        ['MIN - 1 as upper bound', MIN_TEST_VALUE, MIN_TEST_VALUE - 1],
    ])('rejects %s', (_label, min, max) => {
        expect(() => randomInteger({ min, max, random: () => 0.5 })).toThrow(
            'min muss kleiner oder gleich max sein',
        );
    });

    it('rejects invalid random values', () => {
        expect(() => randomInteger({ min: 1, max: 2, random: () => 1 })).toThrow(
            'Zufallswert muss im Bereich [0, 1) liegen',
        );
    });
});
