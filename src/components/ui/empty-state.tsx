import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
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
    <View className="items-center justify-center gap-two py-six px-four">
      <SymbolView name={symbol} size={40} tintColor={theme.textSecondary} />
      <ThemedText type="smallBold" className="text-center">
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" className="text-center">
        {hint}
      </ThemedText>
    </View>
  );
}
