import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/components/theme';

type ShadowGeometry = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  opacity: number;
};

const shadow = {
  sm: { offsetX: 0, offsetY: 2, blurRadius: 6, opacity: 0.08 },
  md: { offsetX: 0, offsetY: 6, blurRadius: 14, opacity: 0.1 },
  lg: { offsetX: 0, offsetY: 12, blurRadius: 24, opacity: 0.14 },
  prominent: { offsetX: 0, offsetY: 0, blurRadius: 18, opacity: 0.7 },
} as const satisfies Record<string, ShadowGeometry>;

/** Formats one or more signed boxShadow layers; positive Y is down, negative Y is up. */
function boxShadowValue(color: string, ...geometries: ShadowGeometry[]): string {
  return geometries
    .map(
      ({ offsetX, offsetY, blurRadius, opacity }) =>
        `${offsetX}px ${offsetY}px ${blurRadius}px ${withAlpha(color, opacity)}`,
    )
    .join(', ');
}

const hotspotGeometry = {
  offsetX: 0,
  offsetY: 1,
  blurRadius: 2,
  opacity: 0.2,
} as const;

const accentNoteGeometry = {
  offsetX: 4,
  offsetY: 5,
  blurRadius: 0,
  opacity: 0.18,
} as const;

export const uiShadowStyles = StyleSheet.create((theme) => ({
  cardBottom: {
    boxShadow: boxShadowValue(theme.shadowCard, shadow.sm),
  },
  raisedCardBottom: {
    boxShadow: boxShadowValue(theme.shadowCard, shadow.md),
  },
  modalBottom: {
    boxShadow: boxShadowValue(theme.shadowCard, shadow.lg),
  },
  prominentCard: {
    boxShadow: boxShadowValue(theme.shadowCard, shadow.prominent),
  },
  floatingControlBottom: {
    boxShadow: boxShadowValue(theme.shadowCard, shadow.md),
  },
  floatingPanelBottom: {
    boxShadow: boxShadowValue(theme.shadowSheet, shadow.lg),
  },
  bottomSheetTop: {
    boxShadow: boxShadowValue(theme.shadowSheet, {
      ...shadow.lg,
      offsetY: -shadow.lg.offsetY,
    }),
  },
  leftDrawerRight: {
    boxShadow: boxShadowValue(theme.shadowSheet, {
      ...shadow.lg,
      offsetX: shadow.lg.offsetY,
      offsetY: 0,
    }),
  },
  /** Tight shadow for the 18×18 hotspot in brochure-hotspot.tsx. */
  hotspotBottom: {
    boxShadow: boxShadowValue(theme.shadowCard, hotspotGeometry),
  },
  /** Hard illustrative shadow for kitchenNoteSheet in meal-planner/dashboard-card.tsx. */
  accentNoteBottomRight: {
    boxShadow: boxShadowValue(theme.accent, accentNoteGeometry),
  },
  none: {
    boxShadow: 'none',
  },
}));
