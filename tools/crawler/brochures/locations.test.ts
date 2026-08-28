import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_MAJOR_LOCATIONS,
  filterLocations,
  parseGeoNamesPostalCodes,
} from './locations';

describe('Crawler Location Management', () => {
  it('parst und aggregiert GeoNames-Format korrekt', () => {
    const rawGeoNames = `DE\t22043\tMarienthal\t\t\t\t\t\t\t53.5724\t10.0951
DE\t22043\tJenfeld\t\t\t\t\t\t\t53.5800\t10.1000
DE\t10115\tBerlin Mitte\t\t\t\t\t\t\t52.5323\t13.3846
FR\t75001\tParis\t\t\t\t\t\t\t48.8600\t2.3400`;

    const locations = parseGeoNamesPostalCodes(rawGeoNames);
    expect(locations).toHaveLength(2); // 22043 und 10115 (FR ignoriert)
    expect(locations[0].zipCode).toBe('10115');
    expect(locations[1].zipCode).toBe('22043');
    // Gemittelte Koordinaten für 22043
    expect(locations[1].latitude).toBeCloseTo((53.5724 + 53.58) / 2);
    expect(locations[1].longitude).toBeCloseTo((10.0951 + 10.1) / 2);
  });

  it('filtert nach PLZ-Zonen (z.B. Zone 2)', () => {
    const filtered = filterLocations(DEFAULT_MAJOR_LOCATIONS, { zone: '2' });
    expect(filtered.every((l) => l.zipCode.startsWith('2'))).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('filtert nach 2-stelligen Präfixen', () => {
    const filtered = filterLocations(DEFAULT_MAJOR_LOCATIONS, {
      prefixes: ['22', '10'],
    });
    expect(filtered.map((l) => l.zipCode)).toContain('22043');
    expect(filtered.map((l) => l.zipCode)).toContain('10115');
    expect(filtered.some((l) => l.zipCode.startsWith('80'))).toBe(false);
  });

  it('filtert nach Limit', () => {
    const filtered = filterLocations(DEFAULT_MAJOR_LOCATIONS, { limit: 3 });
    expect(filtered).toHaveLength(3);
  });
});
