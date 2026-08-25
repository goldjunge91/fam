#!/usr/bin/env bun
/**
 * Echte OFF-Produktsuche zum Bewerten der geplanten Ranking-Idee.
 *
 * Beispiele:
 *   bun tools/product-search-lab/search.ts "1l coca ccola"
 *   bun tools/product-search-lab/search.ts "haferflocken kernig" --market rewe
 *   bun tools/product-search-lab/search.ts "cola" --compare --limit 20
 *   bun tools/product-search-lab/search.ts "cola" --json > /tmp/cola.json
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';

type Market = 'none' | 'rewe' | 'edeka';

type Product = {
  code: string | null;
  name: string;
  brand: string;
  quantity: string;
  stores: string;
};

type ParsedQuery = {
  normalized: string;
  tokens: string[];
  quantity: number | null;
  unit: string | null;
};

type RankedProduct = Product & {
  score: number;
  reasons: string[];
};

type PreparedProduct = Product & {
  normalizedName: string;
  normalizedBrand: string;
  nameWords: string[];
  allWords: string[];
};

const DEFAULT_DUMP = path.resolve(import.meta.dir, '../../scripts/dump_data/products_de.db');
const LIMIT = 30;
const PRIVATE_LABELS: Record<Exclude<Market, 'none'>, string[]> = {
  rewe: ['ja', 'ja!', 'rewe beste wahl', 'rewe bio', 'rewe feine welt'],
  edeka: ['gut und guenstig', 'gut & guenstig', 'edeka bio', 'edeka eigenmarke'],
};

function usage(): never {
  console.log(`
Echte OFF-Produktsuche

Aufruf:
  bun tools/product-search-lab/search.ts <suchbegriff> [optionen]

Optionen:
  --market neutral|rewe|edeka  Marktgewichtung (Standard: neutral)
  --limit <n>                  Anzahl Treffer (Standard: 30)
  --compare                    neutral, REWE und EDEKA direkt vergleichen
  --json                       maschinenlesbares JSON ausgeben
  --dump <pfad>                anderen SQLite-Dump verwenden
  --help                       diese Hilfe anzeigen

Beispiele:
  bun tools/product-search-lab/search.ts "1l coca ccola"
  bun tools/product-search-lab/search.ts "haferflocken kernig" --market rewe
  bun tools/product-search-lab/search.ts "cola" --compare --limit 15
`);
  process.exit(0);
}

function parseArgs(args: string[]) {
  if (args.includes('--help')) usage();

  const positional: string[] = [];
  let market: Market = 'none';
  let limit = LIMIT;
  let compare = false;
  let json = false;
  let dump = DEFAULT_DUMP;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--market') {
      const value = args[++index];
      if (!['none', 'rewe', 'edeka'].includes(value)) throw new Error(`Unbekannter Markt: ${value}`);
      market = value as Market;
    } else if (arg === '--limit') {
      limit = Number(args[++index]);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new Error('--limit muss zwischen 1 und 200 liegen.');
      }
    } else if (arg === '--dump') {
      dump = path.resolve(args[++index]);
    } else if (arg === '--compare') {
      compare = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unbekannte Option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  const query = positional.join(' ').trim();
  if (!query) usage();
  return { query, market, limit, compare, json, dump };
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'a')
    .replaceAll('ö', 'o')
    .replaceAll('ü', 'u')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9.,]+/g, ' ')
    .replace(',', '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQuery(value: string): ParsedQuery {
  const normalized = normalize(value);
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|ml|l)(?=\s|$)/);
  const quantity = match ? Number(match[1]) : null;
  const unit = match?.[2] ?? null;
  const withoutQuantity = normalized.replace(match?.[0] ?? '', ' ').replace(/\s+/g, ' ').trim();
  return {
    normalized,
    tokens: withoutQuantity.split(' ').filter(Boolean),
    quantity,
    unit,
  };
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function quantityMatches(raw: string, query: ParsedQuery): 'exact' | 'unit' | null {
  if (!query.unit) return null;
  const match = normalize(raw).match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)/);
  if (!match) return null;
  if (match[2] !== query.unit) return null;
  return Number(match[1]) === query.quantity ? 'exact' : 'unit';
}

function canonicalWords(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

function prepareProduct(product: Product): PreparedProduct {
  const normalizedName = normalize(product.name);
  const normalizedBrand = normalize(product.brand);
  return {
    ...product,
    normalizedName,
    normalizedBrand,
    nameWords: canonicalWords(product.name),
    allWords: canonicalWords(`${product.name} ${product.brand}`),
  };
}

function isPrivateLabel(product: Product, market: Exclude<Market, 'none'>): boolean {
  const labels = PRIVATE_LABELS[market];
  const haystack = ` ${normalize(`${product.brand} ${product.name}`)} `;
  return labels.some((label) => {
    const normalizedLabel = normalize(label);
    return haystack.includes(` ${normalizedLabel} `);
  });
}

function rank(product: PreparedProduct, query: ParsedQuery, market: Market): RankedProduct {
  const name = product.normalizedName;
  const brand = product.normalizedBrand;
  const words = product.allWords;
  const reasons: string[] = [];
  let score = 0;

  if (query.tokens.length > 0 && name.includes(query.tokens.join(' '))) {
    score += 80;
    reasons.push('exakte Phrase');
  }

  let exactTokens = 0;
  let fuzzyTokens = 0;
  let nameTokens = 0;
  for (const token of query.tokens) {
    if (product.nameWords.some((word) => word.includes(token))) {
      nameTokens += 1;
      exactTokens += 1;
      score += 35;
      continue;
    }
    if (words.some((word) => word.includes(token))) {
      exactTokens += 1;
      score += 10;
      continue;
    }
    const nearest = words.reduce((best, word) => {
      if (Math.abs(token.length - word.length) > 2 || token[0] !== word[0]) return best;
      return Math.min(best, editDistance(token, word));
    }, 99);
    const allowedDistance = token.length <= 4 ? 1 : 2;
    if (nearest <= allowedDistance) {
      fuzzyTokens += 1;
      score += name.includes(token.slice(0, 2)) ? 22 : 8;
    }
  }
  if (nameTokens === query.tokens.length && query.tokens.length > 1) {
    score += 35;
    reasons.push('alle Begriffe');
  } else if (nameTokens > 0) {
    reasons.push('Name passend');
  } else if (fuzzyTokens > 0) {
    reasons.push('Tippfehler toleriert');
  }

  const quantity = quantityMatches(product.quantity, query);
  if (quantity === 'exact') {
    score += 45;
    reasons.push(`${query.quantity}${query.unit} passend`);
  } else if (quantity === 'unit') {
    score += 8;
    reasons.push(`Einheit ${query.unit}`);
  }

  if (query.tokens.some((token) => brand.includes(token))) {
    score += 18;
    reasons.push('Marke passend');
  }

  if (market !== 'none' && isPrivateLabel(product, market)) {
    score += 35;
    reasons.push(`${market.toUpperCase()}-Eigenmarke`);
  }

  // OFF führt keine verlässliche Ranking-Spalte im Dump. Die Existenz eines
  // Marken- und Mengenwertes ist nur ein schwaches Stabilitätssignal.
  if (product.brand) score += 2;
  if (product.quantity) score += 1;

  return { ...product, score, reasons };
}

function readProducts(dbPath: string, query: ParsedQuery): { products: Product[]; total: number } {
  if (!existsSync(dbPath)) throw new Error(`Dump nicht gefunden: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  try {
    const total = db.query<{ count: number }>('select count(*) as count from products').get()?.count ?? 0;
    const anchors = query.tokens
      .map((token) => token.slice(0, Math.min(token.length, 3)))
      .filter((token) => token.length >= 2);
    if (anchors.length === 0) return { products: [], total };
    const conditions = anchors.flatMap(() => ['lower(product_name) like ?', 'lower(brand) like ?']);
    const values = anchors.flatMap((anchor) => [`%${anchor}%`, `%${anchor}%`]);
    const rows = db
      .query(
        `select code, coalesce(product_name, '') as name,
                coalesce(brand, '') as brand, coalesce(quantity, '') as quantity,
                coalesce(stores, '') as stores
         from products
         where product_name is not null and length(trim(product_name)) > 0
           and (${conditions.join(' or ')})`,
      )
      .all(...values) as Product[];
    return { products: rows, total };
  } finally {
    db.close();
  }
}

function search(products: PreparedProduct[], rawQuery: string, market: Market, limit: number, totalProducts: number) {
  const query = parseQuery(rawQuery);
  const ranked = products
    .map((product) => rank(product, query, market))
    .filter((product) => product.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'de'))
    .slice(0, limit);
  return { query, market, totalProducts, candidates: products.length, results: ranked };
}

function printHuman(result: ReturnType<typeof search>) {
  const { query, market, results, totalProducts } = result;
  console.log(`\nSuche: ${query.normalized}`);
  console.log(`Markt: ${market === 'none' ? 'neutral' : market.toUpperCase()} · ${totalProducts.toLocaleString('de-DE')} Produkte im Dump · ${result.candidates.toLocaleString('de-DE')} Suchkandidaten`);
  console.log(`Tokens: ${query.tokens.join(', ') || '—'}${query.quantity ? ` · Menge: ${query.quantity}${query.unit}` : ''}\n`);
  results.forEach((product, index) => {
    const brand = product.brand ? ` · ${product.brand}` : '';
    const quantity = product.quantity ? ` · ${product.quantity}` : '';
    console.log(`${String(index + 1).padStart(2, ' ')}  ${product.name}${brand}${quantity}`);
    console.log(`    ${product.code ?? 'ohne Barcode'} · Score ${product.score.toFixed(1)} · ${product.reasons.join(', ') || 'Basis-Treffer'}`);
  });
  if (results.length === 0) console.log('Keine Treffer.');
}

const options = parseArgs(process.argv.slice(2));
const query = parseQuery(options.query);
const dump = readProducts(options.dump, query);
const products = dump.products.map(prepareProduct);
const markets: Market[] = options.compare ? ['none', 'rewe', 'edeka'] : [options.market];
const results = markets.map((market) => search(products, options.query, market, options.limit, dump.total));

if (options.json) {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  results.forEach(printHuman);
}
