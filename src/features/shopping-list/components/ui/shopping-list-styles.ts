import { StyleSheet } from 'react-native-unistyles';

import { radius, space } from '@/components/theme';

export const shoppingListStyles = StyleSheet.create((theme) => ({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: space.sm,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: space.xs / 2,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 0,
    gap: space.sm,
  },
  trailingMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
    gap: space.sm,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  checkedName: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  quantity: {
    flexShrink: 0,
    textAlign: 'right',
  },
  price: {
    flexShrink: 0,
    textAlign: 'right',
  },
  recipeHint: {
    opacity: 0.75,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accent,
  },
  checkboxUnselected: {
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  modeCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: radius.s,
  },
  modeCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: radius.s,
  },
  categoryName: {
    flex: 1,
    minWidth: 0,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
    paddingLeft: space.md + space.sm - space.xs / 4,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  categoryChevron: {
    width: 24,
    textAlign: 'center',
  },
  form: {
    gap: space.md,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  formColumn: {
    flex: 1,
    gap: space.xs,
  },
  detailsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  detailsSummary: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  detailsContent: {
    gap: space.md,
    paddingBottom: space.xs,
  },
  productSummary: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.famLarge,
    backgroundColor: theme.backgroundSoft,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
    gap: space.xs / 2,
  },
  productMeta: {
    alignItems: 'flex-end',
  },
}));
