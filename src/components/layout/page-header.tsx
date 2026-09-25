import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { space } from '@/components/theme/index';
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
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  side: {
    minWidth: 39,
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
    marginBottom: 0,
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
