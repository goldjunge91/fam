#!/usr/bin/env bun
/**
 * Voll-Scan ueber alle deutschen PLZ: fragt nur die Bring-Offers-Liste ab
 * (keine Detail-Calls, keine Bild-Downloads) und sammelt je PLZ alle
 * gelieferten Prospekte samt Haendler, BRN, Gueltigkeit und Seitenzahl.
 * Fortsetzbar: bereits gespeicherte PLZ werden uebersprungen.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT_DIR = "tools/crawler/data/listing-only";
const OUT_FILE = join(OUT_DIR, "all-stores-full.json");

type Tokens = { authToken: string; apiKey: string; userUuid: string };

function envTokens(): Tokens {
  let authToken = process.env.BRING_AUTH_TOKEN?.trim();
  let apiKey = process.env.BRING_API_KEY?.trim();
  let userUuid = process.env.BRING_USER_UUID?.trim();
  if (existsSync("tokens_backup.env")) {
    const content = readFileSync("tokens_backup.env", "utf8");
    const get = (key: string): string | undefined => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && match[1]?.trim() === key) {
          return match[2]?.trim().replace(/^["]|["]$/g, "");
        }
      }
      return undefined;
    };
    authToken = authToken ?? get("BRING_AUTH_TOKEN");
    apiKey = apiKey ?? get("BRING_API_KEY");
    userUuid = userUuid ?? get("BRING_USER_UUID");
  }
  if (!authToken || !apiKey || !userUuid) {
    throw new Error("BRING_AUTH_TOKEN, BRING_API_KEY und BRING_USER_UUID erforderlich.");
  }
  return { authToken, apiKey, userUuid };
}

function liveHeaders(tokens: Tokens): Record<string, string> {
  return {
    Authorization: "Bearer " + tokens.authToken,
    "X-BRING-API-KEY": tokens.apiKey,
    "X-BRING-CLIENT": "iOS",
    "X-BRING-COUNTRY": "DE",
    "X-BRING-VERSION": "4.110.0",
    "X-BRING-USER-UUID": tokens.userUuid,
    "Accept-Language": "de-DE",
    Accept: "application/json",
  };
}

async function fetchJsonWithRetry(url: string, headers: Record<string, string>): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (response.ok) return await response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) {
        throw new Error("API Status " + response.status + " fuer " + new URL(url).pathname);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error("Unerreichbar: " + url);
}

export type BrochureLocation = {
  zipCode: string;
  latitude: number;
  longitude: number;
  cityName?: string;
};

type OfferEntry = {
  brn: string;
  storeName: string;
  title: string;
  validFrom: string;
  validUntil: string;
  pageCount: number;
};

type FullResult = {
  generatedAt: string;
  totalLocations: number;
  completedLocations: number;
  byZipCode: Record<string, OfferEntry[]>;
  shard?: {
    index: number;
    count: number;
    zipCodes: string[];
  };
};

export type AllStoresFullArguments = {
  shardIndex?: number;
  shardCount?: number;
  outputPath: string;
};

export function parseAllStoresFullArguments(args: readonly string[]): AllStoresFullArguments {
  const result: AllStoresFullArguments = { outputPath: OUT_FILE };
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument) continue;
    const equalsIndex = argument.indexOf("=");
    const flag = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    if (!["--shard-index", "--shard-count", "--output"].includes(flag)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = equalsIndex < 0 ? args[++index] : argument.slice(equalsIndex + 1);
    if (!value || value.startsWith("--")) throw new Error(`Expected a value after ${flag}`);
    values.set(flag, value);
  }

  const shardIndexValue = values.get("--shard-index");
  const shardCountValue = values.get("--shard-count");
  if ((shardIndexValue === undefined) !== (shardCountValue === undefined)) {
    throw new Error("--shard-index and --shard-count are required together");
  }
  if (shardIndexValue !== undefined && shardCountValue !== undefined) {
    const shardIndex = Number(shardIndexValue);
    const shardCount = Number(shardCountValue);
    if (
      !Number.isSafeInteger(shardIndex) ||
      !Number.isSafeInteger(shardCount) ||
      shardCount < 1 ||
      shardIndex < 0 ||
      shardIndex >= shardCount
    ) {
      throw new Error("Shard index and count must describe a valid shard");
    }
    result.shardIndex = shardIndex;
    result.shardCount = shardCount;
  }
  if (values.has("--output")) result.outputPath = values.get("--output")!;
  return result;
}

export function partitionLocations(
  locations: readonly BrochureLocation[],
  shardIndex: number,
  shardCount: number,
): BrochureLocation[] {
  if (
    !Number.isSafeInteger(shardIndex) ||
    !Number.isSafeInteger(shardCount) ||
    shardCount < 1 ||
    shardIndex < 0 ||
    shardIndex >= shardCount
  ) {
    throw new Error("Shard index and count must describe a valid shard");
  }
  return [...locations]
    .sort((left, right) => left.zipCode.localeCompare(right.zipCode))
    .filter((_, index) => index % shardCount === shardIndex);
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = path + "." + process.pid + ".tmp";
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryPath, path);
}

async function fetchLocationEntries(
  location: BrochureLocation,
  headers: Record<string, string>,
): Promise<OfferEntry[]> {
  const params = new URLSearchParams({
    type: "brochure",
    providerId: "bring-de",
    lat: String(location.latitude),
    long: String(location.longitude),
    zipCode: location.zipCode,
  });
  const url = "https://production.bringapi.app/offers/rest/v1/offers?" + params;
  const value = await fetchJsonWithRetry(url, headers);
  const list = value as { offers?: unknown[] };
  const offers = Array.isArray(list.offers) ? list.offers : [];
  const entries: OfferEntry[] = [];
  for (const raw of offers) {
    const offer = raw as Record<string, unknown>;
    const brn = typeof offer.brn === "string" ? offer.brn : undefined;
    if (!brn) continue;
    const company = (offer.company ?? offer.retailer) as Record<string, unknown> | undefined;
    const storeName =
      typeof company?.title === "string"
        ? company.title
        : typeof company?.name === "string"
          ? company.name
          : "";
    const offerPages = Array.isArray(offer.pages) ? offer.pages : [];
    entries.push({
      brn,
      storeName,
      title: typeof offer.title === "string" ? offer.title : "",
      validFrom:
        typeof offer.activeFrom === "string"
          ? offer.activeFrom
          : typeof offer.validFrom === "string"
            ? offer.validFrom
            : "",
      validUntil:
        typeof offer.activeTo === "string"
          ? offer.activeTo
          : typeof offer.validUntil === "string"
            ? offer.validUntil
            : "",
      pageCount: offerPages.length,
    });
  }
  return entries;
}

async function main(): Promise<void> {
  const args = parseAllStoresFullArguments(process.argv.slice(2));
  const { loadTargetLocations } = await import("../locations");
  const locations: BrochureLocation[] = await loadTargetLocations({ all: true });
  await mkdir(OUT_DIR, { recursive: true });
  const headers = liveHeaders(envTokens());
  const concurrency = 8;

  if (args.shardIndex !== undefined && args.shardCount !== undefined) {
    const shardLocations = partitionLocations(locations, args.shardIndex, args.shardCount);
    const byZipCode: Record<string, OfferEntry[]> = {};
    console.log(
      `Voll-Scan-Shard ${args.shardIndex + 1}/${args.shardCount}: ${shardLocations.length} PLZ | Concurrency: ${concurrency}`,
    );

    for (let index = 0; index < shardLocations.length; index += concurrency) {
      const chunk = shardLocations.slice(index, index + concurrency);
      const results = await Promise.all(
        chunk.map(async (location) => [
          location.zipCode,
          await fetchLocationEntries(location, headers),
        ] as const),
      );
      for (const [zipCode, entries] of results) byZipCode[zipCode] = entries;
    }

    const state: FullResult = {
      generatedAt: new Date().toISOString(),
      totalLocations: shardLocations.length,
      completedLocations: shardLocations.length,
      byZipCode: Object.fromEntries(
        Object.entries(byZipCode).sort(([left], [right]) => left.localeCompare(right)),
      ),
      shard: {
        index: args.shardIndex,
        count: args.shardCount,
        zipCodes: shardLocations.map(({ zipCode }) => zipCode),
      },
    };
    await writeJsonAtomic(args.outputPath, state);
    console.log(`Shard fertig: ${state.completedLocations}/${state.totalLocations} PLZ | Report: ${args.outputPath}`);
    return;
  }

  const expectedZipCodes = new Set(locations.map((location) => location.zipCode));
  let state: FullResult = {
    generatedAt: new Date().toISOString(),
    totalLocations: locations.length,
    completedLocations: 0,
    byZipCode: {},
  };
  if (existsSync(args.outputPath)) {
    try {
      const previous = JSON.parse(await readFile(args.outputPath, "utf8")) as FullResult;
      if (previous.byZipCode) {
        const byZipCode = Object.fromEntries(
          Object.entries(previous.byZipCode).filter(([zipCode]) => expectedZipCodes.has(zipCode)),
        );
        state = {
          ...previous,
          totalLocations: locations.length,
          completedLocations: Object.keys(byZipCode).length,
          byZipCode,
        };
        console.log("Fortsetzung: " + Object.keys(state.byZipCode).length + " PLZ bereits geladen.");
      }
    } catch {
      console.warn("Vorhandener Report unlesbar, Start von vorne.");
    }
  }

  const remaining = locations.filter((location) => !state.byZipCode[location.zipCode]);
  console.log("Voll-Scan: " + remaining.length + " von " + locations.length + " PLZ verbleibend | Concurrency: " + concurrency);

  let processed = 0;
  let failed = 0;
  let lastFlush = Date.now();

  async function processLocation(location: BrochureLocation): Promise<void> {
    state.byZipCode[location.zipCode] = await fetchLocationEntries(location, headers);
    state.completedLocations = Object.keys(state.byZipCode).length;
    processed++;
    const now = Date.now();
    if (now - lastFlush > 30000 || processed === remaining.length) {
      lastFlush = now;
      await writeJsonAtomic(args.outputPath, state);
      const percent = ((processed / remaining.length) * 100).toFixed(1);
      console.log(percent + "% | " + processed + "/" + remaining.length + " PLZ | gespeichert");
    }
  }

  for (let index = 0; index < remaining.length; index += concurrency) {
    const chunk = remaining.slice(index, index + concurrency);
    await Promise.all(
      chunk.map((location) =>
        processLocation(location).catch((error: unknown) => {
          failed++;
          console.warn(
            "Fehler " + location.zipCode + ": " + (error instanceof Error ? error.message : String(error)),
          );
        }),
      ),
    );
  }

  await writeJsonAtomic(args.outputPath, state);
  console.log("Fertig: " + state.completedLocations + "/" + state.totalLocations + " PLZ | Fehler: " + failed);
  console.log("Report: " + args.outputPath);
  if (failed > 0 || state.completedLocations !== locations.length) {
    throw new Error(`PLZ-Vollscan unvollständig: ${state.completedLocations}/${locations.length}; ${failed} Abfragen fehlgeschlagen.`);
  }
}

if (process.argv[1]?.endsWith("all-stores-full.ts")) {
  main().catch((error: unknown) => {
    console.error("Fehler: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
