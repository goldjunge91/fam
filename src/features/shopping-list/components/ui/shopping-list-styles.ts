import { StyleSheet } from 'react-native';

import { type Palette, radius, space } from '@/components/theme';

export function makeShoppingListStyles(colors: Palette) {
  return StyleSheet.create({
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.md,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    checkboxUnselected: {
      borderColor: colors.border,
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
      borderRadius: 3,
    },
    modeCategoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
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
      paddingLeft: space.md + 7,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    categoryChevron: {
      width: 24,
      textAlign: 'center',
    },
  });
}
