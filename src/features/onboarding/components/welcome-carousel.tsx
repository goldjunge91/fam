import { Button, Column, Host, Row, Spacer, Text } from '@expo/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
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
    <Host matchContents>
      <Column style={styles.container}>
        <Spacer size={Spacing.four} />
        <Text textStyle={styles.iconText}>{current.icon}</Text>
        <Spacer size={Spacing.three} />
        <Text textStyle={{ ...styles.title, color: theme.text }}>{current.title}</Text>
        <Spacer size={Spacing.two} />
        <Text textStyle={{ ...styles.description, color: theme.textSecondary }}>
          {current.description}
        </Text>

        <Spacer size={Spacing.four} />

        <Row style={styles.paginationRow}>
          {SLIDES.map((slide, idx) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                {
                  backgroundColor: idx === slideIndex ? theme.accent : theme.border,
                  width: idx === slideIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </Row>

        <Spacer size={Spacing.four} />

        <Column style={styles.buttonContainer}>
          {isLast ? (
            <Button onPress={onStart}>Jetzt starten</Button>
          ) : (
            <Button onPress={() => setSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))}>
              Weiter
            </Button>
          )}
        </Column>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  iconText: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  paginationRow: {
    paddingVertical: Spacing.two,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
  },
});
