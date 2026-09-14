import { StyleSheet } from 'react-native-unistyles';

export const profileEditStyles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.space.sm,
  },
  fields: {
    gap: theme.space.lg,
  },
  passwordButton: {
    marginTop: theme.space.sm,
  },
  summaries: {
    gap: theme.space.lg + theme.space.sm,
    marginTop: theme.space.sm,
  },
  formError: {
    paddingHorizontal: theme.space.xs,
  },
  summaryHeading: {
    gap: theme.space.xs / 2,
    marginBottom: theme.space.sm,
  },
  biometricsCard: {
    borderRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.lg,
  },
  foodRulesCard: {
    borderRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.lg,
  },
  summaryRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
  summaryRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  summaryLabel: {
    width: 128,
  },
  summaryValue: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  summaryChevron: {
    minWidth: 24,
    alignItems: 'flex-end',
  },
  biometricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  biometricsEdit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  biometricsWeight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    paddingVertical: theme.space.lg,
  },
  biometricsWeightCopy: {
    gap: theme.space.xs / 2,
  },
  biometricsFactsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.space.lg,
    paddingVertical: theme.space.lg,
  },
  biometricsFactsRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  biometricsFact: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs / 2,
  },
  biometricsFactBordered: {
    paddingRight: theme.space.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.border,
  },
  privateNote: {
    paddingHorizontal: theme.space.xs,
  },
}));
