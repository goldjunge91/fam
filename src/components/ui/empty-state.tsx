import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  symbol: SymbolViewProps['name'];
  title: string;
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
