import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrochureLocation } from './types';

// Fallback-Stammdaten für die wichtigsten deutschen Ballungsräume
export const DEFAULT_MAJOR_LOCATIONS: BrochureLocation[] = [
  { zipCode: '10115', latitude: 52.5323, longitude: 13.3846, cityName: 'Berlin Mitte' },
  { zipCode: '20095', latitude: 53.5511, longitude: 9.9937, cityName: 'Hamburg' },
  { zipCode: '22043', latitude: 53.5724, longitude: 10.0951, cityName: 'Hamburg Marienthal' },
  { zipCode: '30159', latitude: 52.3759, longitude: 9.732, cityName: 'Hannover' },
  { zipCode: '40213', latitude: 51.2277, longitude: 6.7735, cityName: 'Düsseldorf' },
  { zipCode: '50667', latitude: 50.9375, longitude: 6.9603, cityName: 'Köln' },
  { zipCode: '60311', latitude: 50.1109, longitude: 8.6821, cityName: 'Frankfurt am Main' },
  { zipCode: '70173', latitude: 48.7758, longitude: 9.1829, cityName: 'Stuttgart' },
  { zipCode: '80331', latitude: 48.1374, longitude: 11.5755, cityName: 'München' },
  { zipCode: '90403', latitude: 49.4521, longitude: 11.0767, cityName: 'Nürnberg' },
  { zipCode: '01067', latitude: 51.0504, longitude: 13.7373, cityName: 'Dresden' },
  { zipCode: '04109', latitude: 51.3397, longitude: 12.3731, cityName: 'Leipzig' },
];

export type LocationFilterOptions = {
  all?: boolean;
  zone?: string; // z. B. "2" oder "2,3"
  prefixes?: string[]; // z. B. ["22", "20", "10"]
  range?: { from: string; to: string }; // z. B. { from: "20000", to: "25000" }
  zipCodes?: string[]; // z. B. ["22043", "10115"]
  samplePercent?: number; // z. B. 10 für 10%, 20 für 20%
  sampleOffset?: number; // Offset für die nächste Tranche (0..N)
  limit?: number;
};

/**
 * Parst eine GeoNames-DE TSV-Datei und verdichtet mehrere Einträge pro 5-stelliger PLZ
 * auf einen mathematisch gemittelten Mittelpunkt.
 */
export function parseGeoNamesPostalCodes(content: string): BrochureLocation[] {
  const aggregates = new Map<
    string,
    { latitudeSum: number; longitudeSum: number; count: number; cityName: string }
  >();

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split('\t');
    const country = columns[0]?.trim();
    const zipCode = columns[1]?.trim();
    const cityName = columns[2]?.trim() || '';
    const latitude = Number(columns[9]);
    const longitude = Number(columns[10]);

    if (
      country !== 'DE' ||
      !zipCode ||
      !/^\d{5}$/.test(zipCode) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const current = aggregates.get(zipCode) ?? {
      latitudeSum: 0,
      longitudeSum: 0,
      count: 0,
      cityName,
    };
    current.latitudeSum += latitude;
    current.longitudeSum += longitude;
    current.count += 1;
    if (!current.cityName && cityName) current.cityName = cityName;
    aggregates.set(zipCode, current);
  }

  const locations: BrochureLocation[] = [...aggregates].map(([zipCode, aggregate]) => ({
    zipCode,
    latitude: aggregate.latitudeSum / aggregate.count,
    longitude: aggregate.longitudeSum / aggregate.count,
    cityName: aggregate.cityName,
  }));

  locations.sort((a, b) => a.zipCode.localeCompare(b.zipCode));
  return locations;
}

/**
 * Filtert eine Liste von Standorten nach den angegebenen Optionen.
 */
export function filterLocations(
  locations: BrochureLocation[],
  options: LocationFilterOptions,
): BrochureLocation[] {
  let filtered = locations;

  if (options.zipCodes && options.zipCodes.length > 0) {
    const set = new Set(options.zipCodes);
    filtered = filtered.filter((loc) => set.has(loc.zipCode));
  } else if (options.prefixes && options.prefixes.length > 0) {
    filtered = filtered.filter((loc) =>
      options.prefixes?.some((prefix) => loc.zipCode.startsWith(prefix)),
    );
  } else if (options.zone) {
    const zones = options.zone.split(',').map((z) => z.trim());
    filtered = filtered.filter((loc) => zones.some((z) => loc.zipCode.startsWith(z)));
  } else if (options.range) {
    filtered = filtered.filter(
      (loc) => loc.zipCode >= options.range!.from && loc.zipCode <= options.range!.to,
    );
  }

  // Sample-Filterung mit Offset (z. B. 20% in 5 Tranchen: Offset 0, 1, 2, 3, 4)
  if (options.samplePercent && options.samplePercent > 0 && options.samplePercent < 100) {
    const step = Math.max(1, Math.round(100 / options.samplePercent));
    const offset = (options.sampleOffset ?? 0) % step;
    filtered = filtered.filter((_, idx) => idx % step === offset);
  }

  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Lädt Standorte aus GeoNames-Datei, ENV oder Standard-Liste und wendet Filter an.
 */
export async function loadTargetLocations(
  options: LocationFilterOptions,
  geoNamesFilePath?: string,
): Promise<BrochureLocation[]> {
  let baseLocations: BrochureLocation[] = [];

  const candidatePaths = [
    geoNamesFilePath,
    process.env.BROCHURE_LOCATIONS_FILE,
    join(process.cwd(), 'tools', 'crawler', 'data', 'geonames-DE.txt'),
    join(import.meta.dirname, '..', 'data', 'geonames-DE.txt'),
    '/tmp/geonames-DE.txt',
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf8');
        baseLocations = parseGeoNamesPostalCodes(content);
        if (baseLocations.length > 1000) {
          console.log(`📍 ${baseLocations.length} deutsche PLZ aus ${filePath} geladen.`);
          break;
        }
      } catch (err) {
        console.warn(`⚠️ Konnte ${filePath} nicht parsen.`, err);
      }
    }
  }

  if (baseLocations.length === 0) {
    const envJson = process.env.BROCHURE_LOCATIONS_JSON;
    if (envJson) {
      try {
        const parsed = JSON.parse(envJson);
        if (Array.isArray(parsed)) baseLocations = parsed;
      } catch {
        // Fallback
      }
    }
  }

  if (baseLocations.length === 0) {
    baseLocations = DEFAULT_MAJOR_LOCATIONS;
  }

  return filterLocations(baseLocations, options);
}
