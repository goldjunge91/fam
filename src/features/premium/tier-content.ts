import type { TFunction } from 'i18next';
import type { PaywallTier } from './types';

export type TierBenefitId =
  | 'guidedCooking'
  | 'directShopping'
  | 'autoRestock'
  | 'recipeSuggestions'
  | 'weeklyPlan';

export interface TierBenefit {
  icon: string;
  id: TierBenefitId;
}

export interface TierContent {
  id: PaywallTier;
  benefits: readonly TierBenefit[];
}

export const TIER_CONTENT: Record<PaywallTier, TierContent> = {
  plus: {
    id: 'plus',
    benefits: [
      { icon: '👨‍🍳', id: 'guidedCooking' },
      { icon: '➕', id: 'directShopping' },
      { icon: '🔄', id: 'autoRestock' },
    ],
  },
  ai: {
    id: 'ai',
    benefits: [
      { icon: '🧠', id: 'recipeSuggestions' },
      { icon: '🗓️', id: 'weeklyPlan' },
    ],
  },
};

function getTierLabel(t: TFunction, tier: PaywallTier): string {
  return tier === 'plus' ? t('premium.tabs.plus') : t('premium.tabs.ai');
}

function getTierText(
  t: TFunction,
  tier: PaywallTier,
  kind:
    | 'heroActive'
    | 'heroInactive'
    | 'subtitleActive'
    | 'subtitleInactive'
    | 'active'
    | 'crossSellTitle'
    | 'crossSellHint',
): string {
  if (tier === 'plus') {
    switch (kind) {
      case 'heroActive':
        return t('premium.plus.heroActive');
      case 'heroInactive':
        return t('premium.plus.heroInactive');
      case 'subtitleActive':
        return t('premium.plus.subtitleActive');
      case 'subtitleInactive':
        return t('premium.plus.subtitleInactive');
      case 'active':
        return t('premium.plus.active');
      case 'crossSellTitle':
        return t('premium.plus.crossSellTitle');
      case 'crossSellHint':
        return t('premium.plus.crossSellHint');
    }
  }

  switch (kind) {
    case 'heroActive':
      return t('premium.ai.heroActive');
    case 'heroInactive':
      return t('premium.ai.heroInactive');
    case 'subtitleActive':
      return t('premium.ai.subtitleActive');
    case 'subtitleInactive':
      return t('premium.ai.subtitleInactive');
    case 'active':
      return t('premium.ai.active');
    case 'crossSellTitle':
      return t('premium.ai.crossSellTitle');
    case 'crossSellHint':
      return t('premium.ai.crossSellHint');
  }
}

function getBenefitText(t: TFunction, id: TierBenefitId, kind: 'title' | 'hint'): string {
  switch (id) {
    case 'guidedCooking':
      return kind === 'title'
        ? t('premium.plus.benefits.guidedCooking.title')
        : t('premium.plus.benefits.guidedCooking.hint');
    case 'directShopping':
      return kind === 'title'
        ? t('premium.plus.benefits.directShopping.title')
        : t('premium.plus.benefits.directShopping.hint');
    case 'autoRestock':
      return kind === 'title'
        ? t('premium.plus.benefits.autoRestock.title')
        : t('premium.plus.benefits.autoRestock.hint');
    case 'recipeSuggestions':
      return kind === 'title'
        ? t('premium.ai.benefits.recipeSuggestions.title')
        : t('premium.ai.benefits.recipeSuggestions.hint');
    case 'weeklyPlan':
      return kind === 'title'
        ? t('premium.ai.benefits.weeklyPlan.title')
        : t('premium.ai.benefits.weeklyPlan.hint');
  }
}

export function getTierContent(t: TFunction, tier: PaywallTier) {
  const benefits = TIER_CONTENT[tier].benefits.map((benefit) => ({
    icon: benefit.icon,
    title: getBenefitText(t, benefit.id, 'title'),
    hint: getBenefitText(t, benefit.id, 'hint'),
  }));

  return {
    tabLabel: getTierLabel(t, tier),
    heroTitleActive: getTierText(t, tier, 'heroActive'),
    heroTitleInactive: getTierText(t, tier, 'heroInactive'),
    heroSubtitleActive: getTierText(t, tier, 'subtitleActive'),
    heroSubtitleInactive: getTierText(t, tier, 'subtitleInactive'),
    activeLabel: getTierText(t, tier, 'active'),
    benefits,
    crossSellTitle: getTierText(t, tier, 'crossSellTitle'),
    crossSellHint: getTierText(t, tier, 'crossSellHint'),
  };
}
