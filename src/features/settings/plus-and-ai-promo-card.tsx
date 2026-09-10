import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card, Press, Row, Txt } from '@/constants/ui';
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
    <Press onPress={() => router.push('/settings/plus-and-ai')} accessibilityRole="button">
      <Card padded={false} elevation="md" style={styles.card}>
        <View
          testID="plus-and-ai-promo-surface"
          style={[styles.cardSurface, { backgroundColor: colors.premiumGradientMid }]}>
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="plusAndAiPromoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.premiumGradientStart} />
                <Stop offset="57%" stopColor={colors.premiumGradientMid} />
                <Stop offset="100%" stopColor={colors.premiumGradientEnd} />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="100" fill="url(#plusAndAiPromoGradient)" />
          </Svg>
          <View style={styles.content}>
            <Row align="flex-start" gap={space.sm}>
              <Txt variant="title" color={colors.premiumOnSurface} style={styles.title}>
                {title}
              </Txt>
              <Txt variant="display" color={withAlpha(colors.premiumOnSurface, 0.24)}>
                ✦
              </Txt>
            </Row>
            <Txt variant="body" color={withAlpha(colors.premiumOnSurface, 0.82)}>
              {subtitle}
            </Txt>
            <View style={[styles.action, { backgroundColor: colors.premiumActionBackground }]}>
              <Txt variant="caption" color={colors.premiumActionText} weight="600">
                {actionLabel}
              </Txt>
            </View>
          </View>
        </View>
      </Card>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    flexShrink: 0,
    borderCurve: 'continuous',
  },
  cardSurface: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    padding: space.xl,
    gap: space.xs,
  },
  title: {
    flex: 1,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
});
