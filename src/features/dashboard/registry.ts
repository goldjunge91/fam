import type { ComponentType } from 'react';
import type { ModulePreferences } from '@/features/settings/module-preferences';

export type CardSize = 'large' | 'small';

export type DashboardCardProps = {
  size: CardSize;
  onLongPress?: () => void;
  disabled?: boolean;
};

export type DashboardCardDef = {
  /** Eindeutiger Schlüssel, korrespondiert oft mit dem Modul-Key. */
  id: string;
  /** Welches Modul muss aktiv sein? undefined = immer sichtbar. */
  moduleKey?: keyof ModulePreferences;
  /** Sortier-Reihenfolge (aufsteigend). */
  order: number;
  /** Default-Größe beim ersten Laden, bevor der User umschaltet. */
  defaultSize: CardSize;
  /** Die React-Komponente. Holt sich ihre Daten selbst via Hooks. */
  component: ComponentType<DashboardCardProps>;
};

const cards: DashboardCardDef[] = [];

/**
 * Registriert eine Dashboard-Card. Wird als Seiteneffekt beim Import der
 * jeweiligen Card-Datei aufgerufen. Duplikate (gleiche `id`) werden ignoriert.
 */
export function registerCard(def: DashboardCardDef) {
  if (!cards.some((c) => c.id === def.id)) {
    cards.push(def);
    cards.sort((a, b) => a.order - b.order);
  }
}

/** Gibt alle registrierten Cards zurück, sortiert nach `order`. */
export function getCards(): readonly DashboardCardDef[] {
  return cards;
}

/**
 * Entfernt alle registrierten Cards. Nur für Tests gedacht, damit
 * Seiteneffekt-Registrierungen isoliert getestet werden können.
 */
export function clearCards() {
  cards.length = 0;
}
