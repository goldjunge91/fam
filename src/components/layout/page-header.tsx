import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/constants/ui';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  align?: 'start' | 'center';
};

const styles = StyleSheet.create({
  header: {
    height: 74,
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  side: {
    minWidth: 39,
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  titleCentered: {
    alignItems: 'center',
  },
  trailing: {
    justifyContent: 'flex-end',
  },
  subtitle: {
    marginBottom: 1,
  },
});

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
      <View style={styles.side}>{leading}</View>
      <View style={[styles.title, align === 'center' && styles.titleCentered]}>
        {subtitle ? (
          <Txt
            variant="label"
            tone="secondary"
            style={styles.subtitle}
            weight="600"
            numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
        <Txt variant="title" numberOfLines={1}>
          {title}
        </Txt>
      </View>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}
