import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { usePremium } from '@/features/premium/premium-provider';

/**
 * Premium-Anstoss auf der Einstellungen-Uebersicht (Figma "00.05 ·
 * Einstellungen"). Navigiert zum eigenen Premium-Screen (`/settings/premium`)
 * statt die Paywall direkt zu praesentieren — siehe `premium-screen.tsx`.
 *
 * Masse 1:1 aus dem fam-settings-premium-flow-Mockup uebernommen
 * (`.fsp-premium` / `.fsp-premium:after` / `strong` / `small` / `span`).
 */
export function PremiumPromoCard() {
  const { isPremium, isForced } = usePremium();

  return (
    <Pressable
      onPress={() => router.push('/settings/premium')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ThemedText style={styles.watermark}>✦</ThemedText>
      <ThemedText style={styles.title}>
        {isPremium ? 'Premium ist aktiv' : 'Premium für den ganzen Haushalt'}
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        {isPremium
          ? 'Alle Mitglieder profitieren von den Premium-Funktionen.'
          : 'Kochmodus, intelligente Einkaufslisten und weitere Automationen.'}
      </ThemedText>
      <View style={styles.pill}>
        <ThemedText style={styles.pillText}>
          {isPremium ? (isForced ? 'Abo verwalten (erzwungen)' : 'Abo verwalten') : 'Premium ansehen'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 21,
    borderCurve: 'continuous',
    padding: 14,
    backgroundColor: '#a36e72',
    experimental_backgroundImage: 'linear-gradient(135deg, #715574 0%, #a36e72 57%, #c59677 100%)',
    boxShadow: '0 13px 28px rgba(103,74,106,.2)',
  },
  watermark: {
    position: 'absolute',
    right: 16,
    top: 9,
    color: 'rgba(255,255,255,0.24)',
    fontSize: 58,
  },
  title: {
    color: '#fff',
    ...FontSize[13],
    lineHeight: 16,
    fontWeight: '600',
  },
  subtitle: {
    width: '78%',
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    ...FontSize[8],
    lineHeight: 10.8,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  pillText: {
    color: '#604765',
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
