import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type EmptyStateProps = {
  symbol: SymbolViewProps['name'];
  title: string;
  /** Was der Nutzer als Naechstes tun kann — ein leerer Screen ohne Hinweis ist eine Sackgasse. */
  hint: string;
};

export function EmptyState({ symbol, title, hint }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View className="items-center justify-center gap-two py-six px-four">
      <SymbolView name={symbol} size={40} tintColor={colors.textSecondary} />
      <Txt variant="body" weight="700" className="text-center">
        {title}
      </Txt>
      <Txt variant="body" tone="secondary" className="text-center">
        {hint}
      </Txt>
    </View>
  );
}
