import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontSize } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SLIDES = [
  {
    id: 'slide-1',
    icon: '🏠',
    title: 'Haushalt & Vorrat an einem Ort',
    description:
      'Verwalte Kühlschrank, Gefrierfach und Vorratsschrank gemeinsam mit allen Haushaltsmitgliedern in Echtzeit.',
  },
  {
    id: 'slide-2',
    icon: '🛒',
    title: 'Geteilte Einkaufsliste',
    description:
      'Artikel gemeinsam auf die Liste setzen, im Supermarkt abhaken und automatisch in den Vorrat übernehmen.',
  },
  {
    id: 'slide-3',
    icon: '🍎',
    title: 'Privates Kalorien-Tracking',
    description:
      'Verfolge deine Nährwerte und Kalorien mit 100% Privatsphäre — deine Gesundheitsdaten bleiben garantiert deine eigenen.',
  },
];

interface WelcomeCarouselProps {
  onStart: () => void;
}

export function WelcomeCarousel({ onStart }: WelcomeCarouselProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const theme = useTheme();

  const isLast = slideIndex === SLIDES.length - 1;
  const current = SLIDES[slideIndex];

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundElement }]}>
        <Text style={styles.iconText}>{current.icon}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{current.title}</Text>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {current.description}
      </Text>

      <View style={styles.paginationRow}>
        {SLIDES.map((slide, idx) => (
          <Pressable
            key={slide.id}
            onPress={() => setSlideIndex(idx)}
            style={[
              styles.dot,
              {
                backgroundColor: idx === slideIndex ? theme.accent : theme.border,
                width: idx === slideIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.buttonContainer}>
        {isLast ? (
          <Button label="Jetzt starten" onPress={onStart} />
        ) : (
          <Button
            label="Weiter"
            onPress={() => setSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  iconText: {
    ...FontSize[52],
    textAlign: 'center',
  },
  title: {
    ...FontSize[22],
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    ...FontSize[15],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  dot: {
    height: 8,
    borderRadius: Radius.xs,
    marginHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
