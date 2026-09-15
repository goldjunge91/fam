import { StyleSheet } from 'react-native-unistyles';

export const profileSheetStyles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xl + theme.space.xs,
    gap: theme.space.lg,
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  passwordSheet: {
    maxHeight: '88%',
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xl + theme.space.xs,
    gap: theme.space.xl + theme.space.xs,
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  handle: {
    width: theme.space.xxl + theme.space.sm,
    height: theme.space.xs,
    alignSelf: 'center',
    marginTop: theme.space.sm + 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.lg,
  },
  headerCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  options: {
    flexShrink: 1,
  },
  optionsContent: {
    paddingBottom: theme.space.sm,
  },
  option: {
    minHeight: theme.space.xxl + theme.space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    marginVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.backgroundElement,
  },
  optionSelected: {
    backgroundColor: theme.backgroundSoft,
    borderRadius: theme.radius.lg,
  },
  optionBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: theme.space.xl + theme.space.xs,
    height: theme.space.xl + theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.accent,
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    backgroundColor: theme.accent,
  },
  passwordFields: {
    gap: theme.space.md,
  },
  visibilityButton: {
    width: theme.space.xxl + theme.space.xl,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
