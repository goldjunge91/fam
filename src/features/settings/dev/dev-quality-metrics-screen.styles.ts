import { StyleSheet } from 'react-native-unistyles';

import { Fonts, font, radius, withAlpha } from '@/components/theme/index';

export const styles = StyleSheet.create((theme) => ({
  loadingState: {
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.xl,
  },
  summaryCard: {
    gap: theme.space.xs,
    backgroundColor: withAlpha(theme.accent, 0.1),
    borderColor: withAlpha(theme.accent, 0.25),
  },
  metricList: {
    gap: theme.space.xs,
  },
  metricRow: {
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  metricCopy: {
    flex: 1,
    gap: 2,
  },
  metricValueBlock: {
    alignItems: 'flex-end',
    gap: theme.space.xs,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 3,
  },
  statusPass: {
    backgroundColor: withAlpha(theme.success, 0.18),
  },
  statusFail: {
    backgroundColor: withAlpha(theme.danger, 0.18),
  },
  statusInsufficient: {
    backgroundColor: withAlpha(theme.warning, 0.18),
  },
  statusUnavailable: {
    backgroundColor: theme.backgroundSoft,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: theme.backgroundSoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  fillPass: {
    backgroundColor: theme.success,
  },
  fillFail: {
    backgroundColor: theme.danger,
  },
  fillInsufficient: {
    backgroundColor: theme.warning,
  },
  fillUnavailable: {
    backgroundColor: theme.border,
  },
  payloadBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: theme.backgroundSoft,
    padding: theme.space.md,
  },
  payloadText: {
    color: theme.text,
    fontFamily: Fonts.mono,
    fontSize: font.sizes.xs,
    lineHeight: font.lineHeights.caption,
  },
}));
