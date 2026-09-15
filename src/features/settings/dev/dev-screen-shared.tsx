import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Txt } from '@/constants/ui';

export type DbSnapshot = {
  userVersion: number;
  storedUserId: string | null;
  pending: number;
  failed: number;
  fridgeItems: number;
  shoppingItems: number;
  storageLocations: number;
};

export const devStyles = StyleSheet.create((theme) => ({
  devRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  devRowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actionStack: {
    marginTop: theme.space.lg,
    gap: theme.space.sm,
  },
}));

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatZeitpunkt(iso: string | null): string {
  if (!iso) return '—';
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? iso : datum.toLocaleString('de-DE');
}

export function Zeile({
  label,
  wert,
  tone,
}: {
  label: string;
  wert: string;
  tone?: 'accent' | 'warning' | 'danger';
}) {
  return (
    <View style={devStyles.devRow}>
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
      <Txt
        variant="caption"
        weight="700"
        tone={tone ?? 'primary'}
        numberOfLines={2}
        style={devStyles.devRowValue}>
        {wert}
      </Txt>
    </View>
  );
}
