import type { LocalBrochureStore } from './types';

export const BROCHURE_MARKET_GROUPS = [
  { id: 'groceries', label: 'Lebensmittel' },
  { id: 'drugstore', label: 'Drogeriemarkt' },
  { id: 'home-improvement', label: 'Heimwerk' },
  { id: 'other', label: 'Weitere Märkte' },
] as const;

export type BrochureMarketGroupId = (typeof BROCHURE_MARKET_GROUPS)[number]['id'];

export type BrochureMarketGroup = {
  id: BrochureMarketGroupId;
  label: string;
  stores: LocalBrochureStore[];
};

const HOME_IMPROVEMENT_TERMS = [
  'bauhaus',
  'obi',
  'hornbach',
  'toom',
  'hagebau',
  'hagebaumarkt',
  'hellweg',
  'baumarkt',
  'bauking',
  'dehner',
];

const DRUGSTORE_TERMS = [
  'budni',
  'dm',
  'drogerie',
  'drogeriemarkt',
  'rossmann',
  'mueller',
  'douglas',
  'notino',
];

const GROCERY_TERMS = [
  'aldi',
  'edeka',
  'kaufland',
  'lidl',
  'netto',
  'penny',
  'rewe',
  'tegut',
  'marktkauf',
  'famila',
  'combi',
  'hit',
  'globus',
  'norma',
  'nahkauf',
  'alnatura',
  'biocompany',
];

function normalizedTokens(store: Pick<LocalBrochureStore, 'id' | 'name'>) {
  return `${store.id} ${store.name}`
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasAnyToken(tokens: readonly string[], terms: readonly string[]) {
  return terms.some((term) => tokens.includes(term));
}

export function getBrochureMarketGroupId(
  store: Pick<LocalBrochureStore, 'id' | 'name'>,
): BrochureMarketGroupId {
  const tokens = normalizedTokens(store);

  if (hasAnyToken(tokens, HOME_IMPROVEMENT_TERMS)) return 'home-improvement';
  if (hasAnyToken(tokens, DRUGSTORE_TERMS)) return 'drugstore';
  if (hasAnyToken(tokens, GROCERY_TERMS)) return 'groceries';
  return 'other';
}

export function groupBrochureStores(stores: readonly LocalBrochureStore[]): BrochureMarketGroup[] {
  return BROCHURE_MARKET_GROUPS.map((group) => ({
    ...group,
    stores: stores.filter((store) => getBrochureMarketGroupId(store) === group.id),
  })).filter((group) => group.stores.length > 0);
}
