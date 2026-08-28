import type { BrochureSource } from '../types';
import { LiveOfferBrochureSource } from './live-offers';

export const ALL_BROCHURE_SOURCES: BrochureSource[] = [
  new LiveOfferBrochureSource(),
];

export function getSourcesByName(names?: string[]): BrochureSource[] {
  if (!names || names.length === 0) return ALL_BROCHURE_SOURCES;
  const set = new Set(names.map((n) => n.toLowerCase().trim()));
  return ALL_BROCHURE_SOURCES.filter((s) => set.has(s.name.toLowerCase()));
}
