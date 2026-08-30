import type { CatalogProduct } from '@/features/product-search/types';

export type ProductSearchMarket = string | readonly string[] | null | undefined;

export type ParsedProductSearchQuery = {
  normalized: string;
  tokens: string[];
  quantity: number | null;
  unit: string | null;
};

type ProductSearchMatch = {
  score: number;
  reasons: string[];
};

const MARKET_ALIASES: Record<string, readonly string[]> = {
  aldi: ['aldi', 'milsani', 'milfina', 'tandil', 'kokett', 'gut bio', 'mamia'],
  rewe: ['rewe', 'ja', 'rewe beste wahl', 'rewe bio', 'rewe feine welt'],
  lidl: [
    'lidl',
    'crownfield',
    'milbona',
    'freeway',
    'combino',
    'freshona',
    'deluxe',
    'pikok',
    'cien',
  ],
  edeka: ['edeka', 'gut und guenstig', 'gut & guenstig', 'edeka bio', 'elkos', 'rio doro'],
  globus: ['globus', 'globus bio', 'jeden tag'],
  marktkauf: ['marktkauf', 'edeka', 'edeka bio', 'gut und guenstig', 'gut & guenstig'],
  kaufland: ['kaufland', 'k classic', 'k bio', 'k favourites', 'k take it veggie', 'k pur'],
};

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

export function normalizeProductSearchQuery(value: string): ParsedProductSearchQuery {
  const normalized = normalize(value);
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|ml|l)(?=\s|$)/);
  const quantity = match ? Number(match[1]) : null;
  const unit = match?.[2] ?? null;
  const withoutQuantity = normalized
    .replace(match?.[0] ?? '', ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

function words(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

function marketMatches(product: CatalogProduct, market: string): boolean {
  const aliases = MARKET_ALIASES[normalize(market)];
  if (!aliases) return false;

  const haystack = ` ${normalize(`${product.brand ?? ''} ${product.name}`)} `;
  return aliases.some((alias) => haystack.includes(` ${normalize(alias)} `));
}

function preferredMarkets(market: ProductSearchMarket): string[] {
  if (typeof market === 'string') return [market];
  return market ? [...market] : [];
}

function quantityMatch(
  product: CatalogProduct,
  query: ParsedProductSearchQuery,
): 'exact' | 'unit' | null {
  if (query.quantity === null || !query.unit || product.quantity === undefined || !product.unit) {
    return null;
  }
  if (product.unit !== query.unit) return null;
  return product.quantity === query.quantity ? 'exact' : 'unit';
}

export function matchProductSearchResult(
  product: CatalogProduct,
  rawQuery: string,
  preferredMarket?: ProductSearchMarket,
): ProductSearchMatch {
  const query = normalizeProductSearchQuery(rawQuery);
  const name = normalize(product.name);
  const brand = normalize(product.brand ?? '');
  const nameWords = words(product.name);
  const allWords = words(`${product.name} ${product.brand ?? ''}`);
  const reasons: string[] = [];
  let score = 0;
  let exactNameTokens = 0;
  let fuzzyNameTokens = 0;

  if (query.tokens.length > 0 && name.includes(query.tokens.join(' '))) {
    score += 80;
    reasons.push('exakte Phrase');
  }

  for (const token of query.tokens) {
    if (nameWords.some((word) => word.includes(token))) {
      exactNameTokens += 1;
      score += 35;
      continue;
    }
    if (allWords.some((word) => word.includes(token))) {
      score += 10;
      continue;
    }

    const nearest = nameWords.reduce((best, word) => {
      if (Math.abs(token.length - word.length) > 2 || token[0] !== word[0]) return best;
      return Math.min(best, editDistance(token, word));
    }, 99);
    const allowedDistance = token.length <= 4 ? 1 : 2;
    if (nearest <= allowedDistance) {
      fuzzyNameTokens += 1;
      score += 22;
    }
  }

  if (exactNameTokens === query.tokens.length && query.tokens.length > 1) {
    score += 35;
    reasons.push('alle Begriffe');
  } else if (exactNameTokens > 0) {
    reasons.push('Name passend');
  } else if (fuzzyNameTokens > 0) {
    reasons.push('Tippfehler toleriert');
  }

  const quantity = quantityMatch(product, query);
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

  const markets = preferredMarkets(preferredMarket);
  const marketIndex = markets.findIndex((market) => marketMatches(product, market));
  if (marketIndex >= 0) {
    score += Math.max(8, 35 - marketIndex * 9);
    reasons.push(`${normalize(markets[marketIndex]).toUpperCase()}-Eigenmarke`);
  }

  return { score, reasons };
}

export function rankProductSearchResults(
  products: readonly CatalogProduct[],
  rawQuery: string,
  preferredMarket?: ProductSearchMarket,
): CatalogProduct[] {
  return products
    .map((product, index) => ({
      product,
      index,
      match: matchProductSearchResult(product, rawQuery, preferredMarket),
    }))
    .filter(({ match }) => match.score > 0)
    .sort((left, right) => right.match.score - left.match.score || left.index - right.index)
    .map(({ product }) => product);
}
