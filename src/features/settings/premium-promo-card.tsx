import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, withAlpha } from '@/constants/theme';
import { usePremium } from '@/features/premium/premium-provider';
import { useTheme } from '@/hooks/use-theme';

/**
 * Premium-Anstoss auf der Einstellungen-Uebersicht (Figma "00.05 ·
 * Einstellungen"). Navigiert zum eigenen Premium-Screen (`/settings/premium`)
 * statt die Paywall direkt zu praesentieren — siehe `premium-screen.tsx`.
 *
 * Masse 1:1 aus dem fam-settings-premium-flow-Mockup uebernommen
 * (`.fsp-premium` / `.fsp-premium:after` / `strong` / `small` / `span`).
 */
export function PremiumPromoCard() {
  const theme = useTheme();
  const { isPremium, isForced } = usePremium();

  return (
    <Pressable
      onPress={() => router.push('/settings/premium')}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.premiumGradientMid,
          experimental_backgroundImage: `linear-gradient(135deg, ${theme.premiumGradientStart} 0%, ${theme.premiumGradientMid} 57%, ${theme.premiumGradientEnd} 100%)`,
          boxShadow: `0 13px 28px ${withAlpha(theme.shadowCard, 0.2)}`,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.watermark, { color: withAlpha(theme.premiumOnSurface, 0.24) }]}>
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
      <View style={[styles.pill, { backgroundColor: theme.premiumActionBackground }]}>
        <ThemedText type="default" style={[styles.pillText, { color: theme.premiumActionText }]}>
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

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    padding: 14,
  },
  watermark: {
    position: 'absolute',
    right: 16,
    top: 9,
    fontSize: 58,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.control,
  },
  pillText: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
