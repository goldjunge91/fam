import type { BrochureSource } from '../types';
import { AldiBrochureSource } from './aldi';
import { DmBrochureSource } from './dm';
import { KauflandBrochureSource } from './kaufland';
import { LidlBrochureSource } from './lidl';
import { LiveOfferBrochureSource } from './live-offers';
import { ReweBrochureSource } from './rewe';

export const ALL_BROCHURE_SOURCES: BrochureSource[] = [
  new LiveOfferBrochureSource(),
  new LidlBrochureSource(),
  new AldiBrochureSource(),
  new KauflandBrochureSource(),
  new ReweBrochureSource(),
  new DmBrochureSource(),
];

export function getSourcesByName(names?: string[]): BrochureSource[] {
  if (!names || names.length === 0) return ALL_BROCHURE_SOURCES;
  const set = new Set(names.map((n) => n.toLowerCase().trim()));
  return ALL_BROCHURE_SOURCES.filter((s) => set.has(s.name.toLowerCase()));
}
