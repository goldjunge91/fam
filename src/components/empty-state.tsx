import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  /**
   * SF-Symbol-Name. Der Typ kommt aus expo-symbols und ist auf die tatsaechlich
   * existierenden Symbole eingeschraenkt — ein Tippfehler faellt beim Typecheck
   * auf, nicht erst als leere Flaeche auf dem Geraet.
   */
  symbol: SymbolViewProps['name'];
  title: string;
  /** Was der Nutzer als Naechstes tun kann — ein leerer Screen ohne Hinweis ist eine Sackgasse. */
  hint: string;
};

export function EmptyState({ symbol, title, hint }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <SymbolView name={symbol} size={40} tintColor={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {hint}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
});
