import type { PaywallTier } from './types';

export interface TierBenefit {
  icon: string;
  title: string;
  hint: string;
}

export interface TierContent {
  heroTitleActive: string;
  heroTitleInactive: string;
  heroSubtitleActive: string;
  heroSubtitleInactive: string;
  activeLabel: string;
  benefits: TierBenefit[];
  /** Titel/Hint dieses Tiers als Cross-Sell-Banner auf der Ansicht des jeweils anderen Tiers. */
  crossSellTitle: string;
  crossSellHint: string;
}

/**
 * Copy und Vorteile je Tier für die kontextuell fokussierte Plus-/AI-Paywall
 * (Variante 3 des UI-Mock-Reviews zu fam-yu6.6). Plus und AI sind unabhängige
 * Entitlements ohne Enthalten-Beziehung — die Cross-Sell-Texte werben additiv
 * für das jeweils andere Abo, statt eines als Obermenge des anderen zu verkaufen.
 */
export const TIER_CONTENT: Record<PaywallTier, TierContent> = {
  plus: {
    heroTitleInactive: 'Mehr für euren Haushalt',
    heroTitleActive: 'Plus ist aktiv',
    heroSubtitleInactive: 'Ein Abo schaltet Plus für alle Mitglieder des Haushalts frei.',
    heroSubtitleActive: 'Euer Haushalt nutzt alle Plus-Funktionen.',
    activeLabel: 'Plus aktiv',
    benefits: [
      {
        icon: '👨‍🍳',
        title: 'Geführter Kochmodus',
        hint: 'Schritte, automatische Timer und Medien',
      },
      {
        icon: '➕',
        title: 'Fehlendes direkt einkaufen',
        hint: 'Aus Rezepten und dem Essensplan übernehmen',
      },
      {
        icon: '🔄',
        title: 'Bestände automatisch ergänzen',
        hint: 'Niedrige Vorräte auf die Einkaufsliste setzen',
      },
    ],
    crossSellTitle: 'Mit Plus kombinieren',
    crossSellHint: 'Geführter Kochmodus, Direkteinkauf und Auto-Ergänzung',
  },
  ai: {
    heroTitleInactive: 'Kochen mit KI',
    heroTitleActive: 'KI ist aktiv',
    heroSubtitleInactive:
      'KI-Rezeptvorschläge und ein automatischer Wochenplan für euren Haushalt.',
    heroSubtitleActive: 'Euer Haushalt nutzt alle KI-Funktionen.',
    activeLabel: 'KI aktiv',
    benefits: [
      { icon: '🧠', title: 'KI-Rezeptvorschläge', hint: 'Passend zu eurem Bestand' },
      { icon: '🗓️', title: 'Automatischer Wochenplan', hint: 'KI stellt den Essensplan zusammen' },
    ],
    crossSellTitle: 'Auf KI upgraden',
    crossSellHint: 'KI-Rezeptvorschläge und automatischer Wochenplan',
  },
};
