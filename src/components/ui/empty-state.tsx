import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type EmptyStateProps = {
  symbol: SymbolViewProps['name'];
  title: string;
  /** Was der Nutzer als Naechstes tun kann — ein leerer Screen ohne Hinweis ist eine Sackgasse. */
  hint: string;
  action?: ReactNode;
};

export function EmptyState({ symbol, title, hint, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <SymbolView name={symbol} size={40} tintColor={colors.textSecondary} />
      <Txt variant="body" weight="700" style={styles.title}>
        {title}
      </Txt>
      <Txt variant="body" tone="secondary" style={styles.hint}>
        {hint}
      </Txt>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  title: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
  },
  action: {
    marginTop: 12,
  },
});
