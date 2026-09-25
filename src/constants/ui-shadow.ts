import { StyleSheet } from 'react-native-unistyles';
import { boxShadowValue, shadow, withAlpha } from '@/components/theme';

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
    boxShadow: boxShadowValue(shadow.sm, theme.shadowCard),
  },
  raisedCardBottom: {
    boxShadow: boxShadowValue(shadow.md, theme.shadowCard),
  },
  modalBottom: {
    boxShadow: boxShadowValue(shadow.lg, theme.shadowCard),
  },
  prominentCard: {
    boxShadow: boxShadowValue(shadow.prominent, theme.shadowCard),
  },
  floatingControlBottom: {
    boxShadow: boxShadowValue(shadow.md, theme.shadowCard),
  },
  floatingPanelBottom: {
    boxShadow: boxShadowValue(shadow.lg, theme.shadowSheet),
  },
  bottomSheetTop: {
    boxShadow: boxShadowValue(shadow.lg, theme.shadowSheet, 'up'),
  },
  leftDrawerRight: {
    boxShadow: boxShadowValue(shadow.lg, theme.shadowSheet, 'right'),
  },
  /** Tight shadow for the 18×18 hotspot in brochure-hotspot.tsx. */
  hotspotBottom: {
    boxShadow: `0px ${hotspotGeometry.offsetY}px ${hotspotGeometry.blurRadius}px ${withAlpha(theme.shadowCard, hotspotGeometry.opacity)}`,
  },
  /** Hard illustrative shadow for kitchenNoteSheet in meal-planner/dashboard-card.tsx. */
  accentNoteBottomRight: {
    boxShadow: `${accentNoteGeometry.offsetX}px ${accentNoteGeometry.offsetY}px ${accentNoteGeometry.blurRadius}px ${withAlpha(theme.accent, accentNoteGeometry.opacity)}`,
  },
  none: {
    boxShadow: 'none',
  },
}));
