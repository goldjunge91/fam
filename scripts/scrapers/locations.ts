import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ScrapeLocation = {
  zipCode: string;
  city: string;
  latitude: number;
  longitude: number;
};

export function parsePostalCodes(content: string): ScrapeLocation[] {
  const locations = new Map<
    string,
    { latitude: number; longitude: number; count: number; city: string }
  >();

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split('\t');
    const zipCode = columns[1]?.trim();
    const latitude = Number(columns[9]);
    const longitude = Number(columns[10]);
    if (
      columns[0]?.trim() !== 'DE' ||
      !zipCode ||
      !/^\d{5}$/.test(zipCode) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const current = locations.get(zipCode) ?? {
      latitude: 0,
      longitude: 0,
      count: 0,
      city: columns[2]?.trim() || zipCode,
    };
    current.latitude += latitude;
    current.longitude += longitude;
    current.count += 1;
    locations.set(zipCode, current);
  }

  return [...locations]
    .map(([zipCode, location]) => ({
      zipCode,
      city: location.city,
      latitude: location.latitude / location.count,
      longitude: location.longitude / location.count,
    }))
    .sort((left, right) => left.zipCode.localeCompare(right.zipCode));
}

export async function loadPostalCodes(): Promise<ScrapeLocation[]> {
  const filePath = join(process.cwd(), 'tools/crawler/brochures/geonames-DE.txt');
  const locations = parsePostalCodes(await readFile(filePath, 'utf8'));
  if (locations.length === 0) throw new Error(`No postal codes found in ${filePath}.`);
  return locations;
}
