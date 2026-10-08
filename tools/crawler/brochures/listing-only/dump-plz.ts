#!/usr/bin/env bun
/** Dumped alle Prospekt-Metadaten einer PLZ ohne Bild-Downloads. */

import { LiveOfferBrochureSource } from '../sources/live-offers';
import { loadTargetLocations } from '../locations';

const zipCodeArg = process.argv
  .find((value) => value.startsWith('--plz='))
  ?.slice('--plz='.length);

if (!zipCodeArg || !/^\d{5}$/.test(zipCodeArg)) {
  console.error('Nutzung: bun run tools/crawler/brochures/listing-only/dump-plz.ts --plz=22043');
  process.exit(1);
}

const locations = await loadTargetLocations({ all: true });
const location = locations.find((entry) => entry.zipCode === zipCodeArg);
if (!location) {
  console.error(`PLZ ${zipCodeArg} nicht in GeoNames-Datei gefunden.`);
  process.exit(1);
}

console.error(`📍 ${location.cityName || zipCodeArg} (${zipCodeArg}) @ ${location.latitude},${location.longitude}`);

const source = new LiveOfferBrochureSource({});
const report = await source.fetchBrochuresForLocationWithDiagnostics(location);

const stores = report.results.map((result) => ({
  storeName: result.store.name,
  brochures: result.brochures.map((brochure) => ({
    id: brochure.id,
    storeId: brochure.storeId,
    title: brochure.title,
    validFrom: brochure.validFrom,
    validUntil: brochure.validUntil,
    pageCount: brochure.pages.length,
    coverImage: brochure.coverImage,
    pageImageUrls: brochure.pages.map((page) => page.imageUrl),
  })),
}));

console.log(JSON.stringify({ zipCode: zipCodeArg, cityName: location.cityName, status: report.status, stores }, null, 2));
