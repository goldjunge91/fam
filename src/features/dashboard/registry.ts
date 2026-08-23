import type { ComponentType } from 'react';
import type { ModulePreferences } from '@/features/settings/module-preferences';

export type CardSize = 'large' | 'small';

export type DashboardCardProps = {
  size: CardSize;
  onLongPress?: () => void;
};

export type DashboardCardDef = {
  id: string;
  /** Ohne Wert immer sichtbar. */
  moduleKey?: keyof ModulePreferences;
  order: number;
  defaultSize: CardSize;
  component: ComponentType<DashboardCardProps>;
};

const cards: DashboardCardDef[] = [];

/** Registriert eine Card einmalig als Import-Seiteneffekt. */
export function registerCard(def: DashboardCardDef) {
  if (!cards.some((c) => c.id === def.id)) {
    cards.push(def);
    cards.sort((a, b) => a.order - b.order);
  }
}

export function getCards(): readonly DashboardCardDef[] {
  return cards;
}

/** Leert das Registry zwischen isolierten Tests. */
export function clearCards() {
  cards.length = 0;
}
