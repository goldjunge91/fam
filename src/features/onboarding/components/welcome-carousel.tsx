import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, Surface, Txt } from '@/constants/ui';

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

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    gap: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  iconCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  subtitle: {
    paddingHorizontal: theme.space.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
  },
  paginationButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    marginHorizontal: theme.space.xs,
    borderRadius: theme.radius.s,
  },
  paginationDotExpanded: {
    width: 24,
  },
  buttonContainer: {
    width: '100%',
    marginTop: theme.space.sm,
  },
}));

export function WelcomeCarousel({ onStart }: WelcomeCarouselProps) {
  const [slideIndex, setSlideIndex] = useState(0);

  const isLast = slideIndex === SLIDES.length - 1;
  const current = SLIDES[slideIndex];

  return (
    <View style={styles.root}>
      <Surface tone="surface" style={styles.iconCircle}>
        <Txt variant="display" center>
          {current.icon}
        </Txt>
      </Surface>

      <Txt variant="subheading" weight="700" center>
        {current.title}
      </Txt>

      <Txt variant="body" tone="secondary" center style={styles.subtitle}>
        {current.description}
      </Txt>

      <View
        style={styles.paginationRow}
        accessibilityRole="tablist"
        accessibilityLabel="Onboarding-Folien">
        {SLIDES.map((slide, idx) => (
          <Press
            key={slide.id}
            onPress={() => setSlideIndex(idx)}
            accessibilityRole="tab"
            accessibilityLabel={`Folie ${idx + 1}`}
            accessibilityState={{ selected: idx === slideIndex }}
            haptic="selection"
            selected={idx === slideIndex}
            style={styles.paginationButton}>
            <View
              style={[styles.paginationDot, idx === slideIndex && styles.paginationDotExpanded]}
            />
          </Press>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        {isLast ? (
          <Button title="Jetzt starten" onPress={onStart} />
        ) : (
          <Button
            title="Weiter"
            onPress={() => setSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))}
          />
        )}
      </View>
    </View>
  );
}
