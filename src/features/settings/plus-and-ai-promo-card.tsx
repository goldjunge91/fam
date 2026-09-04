import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { usePremium } from '@/features/premium/premium-provider';

export function PlusAndAiPromoCard() {
  const { colors } = useTheme();
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
        backgroundColor: colors.basil,
        experimental_backgroundImage: `linear-gradient(135deg, ${colors.basil} 0%, ${colors.grape} 57%, ${colors.carrot} 100%)`,
        boxShadow: `0 13px 28px ${withAlpha(colors.text, 0.2)}`,
      }}>
      <Txt
        variant="body"
        tone="onAccent"
        className="absolute right-[16px] top-[9px]"
        style={{ color: withAlpha(colors.inverse, 0.24), fontSize: 58, lineHeight: 64 }}>
        ✦
      </Txt>
      <Txt variant="title" tone="onAccent">
        {title}
      </Txt>
      <Txt variant="body" tone="onAccent" style={{ color: withAlpha(colors.inverse, 0.82) }}>
        {subtitle}
      </Txt>
      <View
        className="self-start mt-[9px] px-[9px] py-[6px] rounded-control"
        style={{ backgroundColor: colors.inverse }}>
        <Txt variant="caption" tone="accent" weight="600">
          {actionLabel}
        </Txt>
      </View>
    </Pressable>
  );
}
