import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  align?: 'start' | 'center';
};

/** Kompakter Header fuer die zentralen App-Bereiche aus dem fam-Designsystem. */
export function PageHeader({
  title,
  subtitle,
  leading,
  trailing,
  align = 'start',
}: PageHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.slot}>{leading}</View>
      <View style={[styles.titleWrap, align === 'center' && styles.titleCentered]}>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
      <View style={[styles.slot, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  slot: {
    minWidth: 39,
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trailing: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleCentered: {
    alignItems: 'center',
  },
  title: {
    ...FontSize[19],
    lineHeight: 23,
    fontWeight: 600,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...FontSize[10],
    lineHeight: 12,
    fontWeight: 600,
    marginBottom: 1,
  },
});
