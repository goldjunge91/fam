#!/usr/bin/env bun
/**
 * Radius-/Raster-Scan: Fragt Bring über ein Deutschland-Raster ab und prüft,
 * welche BRNs zurückgegeben werden. Optional auf einen BRN oder Händler filtern.
 */

import { LiveOfferBrochureSource } from '../sources/live-offers';

const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(`--${name}=`.length);

const brnFilter = arg('brn');
const storeFilter = arg('store')?.toLocaleLowerCase('de-DE');
const rasterArg = arg('raster') ?? 'major';

const RASTERS: Record<string, Array<{ zipCode: string; latitude: number; longitude: number; cityName?: string }>> = {
  major: [
    { zipCode: '01067', latitude: 51.0504, longitude: 13.7373, cityName: 'Dresden' },
    { zipCode: '04109', latitude: 51.3397, longitude: 12.3731, cityName: 'Leipzig' },
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
  ],
};

const raster = RASTERS[rasterArg];
if (!raster) {
  console.error(`Unbekanntes Raster: ${rasterArg}. Verfügbar: major`);
  process.exit(1);
}

const source = new LiveOfferBrochureSource({});

type Result = {
  zipCode: string;
  cityName?: string;
  foundBrns: string[];
  matched: Array<{ brn: string; storeName: string; pageCount: number }>;
  errors: string[];
};

const results: Result[] = [];

console.log(`🛰️ Raster-Scan über ${raster.length} Standorte${brnFilter ? ` | BRN-Filter: ${brnFilter}` : ''}${storeFilter ? ` | Händler-Filter: ${storeFilter}` : ''}`);

for (const location of raster) {
  try {
    const report = await source.fetchBrochuresForLocationWithDiagnostics(location);
    const found: string[] = [];
    const matched: Array<{ brn: string; storeName: string; pageCount: number }> = [];
    for (const result of report.results) {
      for (const brochure of result.brochures) {
        found.push(brochure.id);
        const brnId = brochure.id.split(':').pop() ?? '';
        const matchesBrn = brnFilter ? brnId === brnFilter : true;
        const matchesStore = storeFilter ? brochure.storeId.includes(storeFilter) : true;
        if (matchesBrn && matchesStore) {
          matched.push({
            brn: brnId,
            storeName: result.store.name,
            pageCount: brochure.pages.length,
          });
        }
      }
    }
    results.push({ zipCode: location.zipCode, cityName: location.cityName, foundBrns: found, matched, errors: [] });
    console.log(`${matched.length > 0 ? '✅' : '➖'} ${location.cityName ?? location.zipCode} (${location.zipCode}): ${report.results.flatMap((r) => r.brochures).length} BRNs, ${matched.length} Treffer${brnFilter || storeFilter ? '' : ' (unfiltert)'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ zipCode: location.zipCode, cityName: location.cityName, foundBrns: [], matched: [], errors: [message] });
    console.warn(`⚠️ ${location.cityName ?? location.zipCode}: ${message}`);
  }
}

const matrix = results.map((result) => ({
  ...result,
  matchedBrnIds: result.matched.map((entry) => entry.brn),
}));

console.log('\n📊 Zusammenfassung:');
const uniqueBrns = new Set(matrix.flatMap((entry) => entry.foundBrns));
console.log(`🔍 ${uniqueBrns.size} einzigartige BRNs über alle Standorte`);
const onlySome = matrix.filter((entry) => entry.matched.length > 0);
if (onlySome.length > 0) {
  console.log(`🎯 Treffer an ${onlySome.length}/${matrix.length} Standorten: ${onlySome.map((entry) => entry.cityName ?? entry.zipCode).join(', ')}`);
} else {
  console.log('❌ Kein Treffer an irgendeinem Standort.');
}

if (process.argv[1]?.endsWith('radius-scan.ts')) {
  await Bun.write('tools/crawler/data/listing-only/radius-scan-' + (storeFilter ?? 'all') + '.json', JSON.stringify(matrix, null, 2));
  console.log('💾 Ergebnis: tools/crawler/data/listing-only/radius-scan-' + (storeFilter ?? 'all') + '.json');
}
