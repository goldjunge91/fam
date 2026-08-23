import type { CategorySource } from '../classification/types';

/**
 * Kurztext für die Herkunfts-Caption im Kategoriefeld (#223 Paket 8,
 * Variante 1 aus dem UI-Checkpoint #230): unterscheidet insbesondere
 * bewusstes "Sonstiges" (`source: 'user'`, `categoryId: null`) von "noch kein
 * automatischer Vorschlag gefunden" (`source: null`, `categoryId: null`) —
 * beides sieht in den Rohdaten gleich aus, ist fachlich aber grundverschieden.
 */
export function describeCategorySource(
  source: CategorySource | null,
  categoryId: string | null,
): string {
  switch (source) {
    case 'user':
      return categoryId === null ? 'bewusst „Sonstiges“' : 'manuell gewählt';
    case 'household_preference':
      return 'gespeicherte Präferenz';
    case 'off_taxonomy':
      return 'automatisch · Produktdaten';
    case 'name_fallback':
      return 'automatisch · Name';
    case null:
      return categoryId === null ? 'kein Vorschlag' : 'automatisch';
  }
}
