import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { usePremium } from '@/features/premium/premium-provider';
import { useTheme } from '@/hooks/use-theme';

export function PlusAndAiPromoCard() {
  const theme = useTheme();
  const { hasPlus, hasAI, isForced } = usePremium();

  const title =
    hasPlus && hasAI
      ? 'Plus & KI sind aktiv'
      : hasPlus
        ? 'Plus ist aktiv'
        : hasAI
          ? 'KI ist aktiv'
          : 'Plus & KI für den ganzen Haushalt';

  const subtitle =
    hasPlus && hasAI
      ? 'Alle Mitglieder profitieren von allen Funktionen.'
      : hasPlus
        ? 'KI-Rezeptvorschläge sind als Upgrade verfügbar.'
        : hasAI
          ? 'Plus ergänzt euer KI-Abo um weitere Automationen.'
          : 'Kochmodus, KI-Vorschläge und weitere Automationen.';

  const actionLabel =
    hasPlus || hasAI
      ? isForced
        ? 'Abo verwalten (erzwungen)'
        : 'Abo verwalten'
      : 'Plus & KI ansehen';

  return (
    <Pressable
      onPress={() => router.push('/settings/plus-and-ai')}
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
        {title}
      </ThemedText>
      <ThemedText type="default" style={{ color: withAlpha(theme.premiumOnSurface, 0.82) }}>
        {subtitle}
      </ThemedText>
      <View
        className="self-start mt-[9px] px-[9px] py-[6px] rounded-control"
        style={{ backgroundColor: theme.premiumActionBackground }}>
        <ThemedText
          type="default"
          className="font-semibold"
          style={{ color: theme.premiumActionText }}>
          {actionLabel}
        </ThemedText>
      </View>
    </Pressable>
  );
}
