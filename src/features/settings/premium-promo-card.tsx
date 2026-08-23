import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { usePremium } from '@/features/premium/premium-provider';
import { useTheme } from '@/hooks/use-theme';

/** Verwendet Laufzeitfarben, da Verlauf und Alpha-Werte nicht statisch sind. */
export function PremiumPromoCard() {
  const theme = useTheme();
  const { isPremium, isForced } = usePremium();

  return (
    <Pressable
      onPress={() => router.push('/settings/premium')}
      accessibilityRole="button"
      className="overflow-hidden rounded-sheet p-[14px] active:opacity-85"
      style={{
        backgroundColor: theme.premiumGradientMid,
        experimental_backgroundImage: `linear-gradient(135deg, ${theme.premiumGradientStart} 0%, ${theme.premiumGradientMid} 57%, ${theme.premiumGradientEnd} 100%)`,
        boxShadow: `0 13px 28px ${withAlpha(theme.shadowCard, 0.2)}`,
      }}>
      <ThemedText
        className="absolute right-[16px] top-[9px] text-[58px]"
        style={{ color: withAlpha(theme.premiumOnSurface, 0.24) }}>
        ✦
      </ThemedText>
      <ThemedText type="subtitle" style={{ color: theme.premiumOnSurface }}>
        {isPremium ? 'Premium ist aktiv' : 'Premium für den ganzen Haushalt'}
      </ThemedText>
      <ThemedText type="default" style={{ color: withAlpha(theme.premiumOnSurface, 0.82) }}>
        {isPremium
          ? 'Alle Mitglieder profitieren von den Premium-Funktionen.'
          : 'Kochmodus, intelligente Einkaufslisten und weitere Automationen.'}
      </ThemedText>
      <View
        className="self-start mt-[9px] px-[9px] py-[6px] rounded-control"
        style={{ backgroundColor: theme.premiumActionBackground }}>
        <ThemedText
          type="default"
          className="font-semibold"
          style={{ color: theme.premiumActionText }}>
          {isPremium
            ? isForced
              ? 'Abo verwalten (erzwungen)'
              : 'Abo verwalten'
            : 'Premium ansehen'}
        </ThemedText>
      </View>
    </Pressable>
  );
}
