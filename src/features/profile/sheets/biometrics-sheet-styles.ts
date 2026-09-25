import { StyleSheet } from 'react-native-unistyles';

// Die wenigen festen Werte erhalten die bestehende Sheet-/Option-Geometrie.
// Semantische Farben, Abstände und Radien kommen aus dem aktiven Theme.
export const biometricsSheetStyles = StyleSheet.create((theme) => ({
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
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    marginTop: theme.space.md,
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
    gap: theme.space.xs / 2,
  },
  content: {
    gap: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
  group: {
    gap: theme.space.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  optionContainer: {
    flex: 1,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
}));
