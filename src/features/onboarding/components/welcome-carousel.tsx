import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';

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

  const isLast = slideIndex === SLIDES.length - 1;
  const current = SLIDES[slideIndex];

  return (
    <View className="complete-container">
      <View className="complete-icon-circle">
        <Text className="complete-icon">{current.icon}</Text>
      </View>

      <Text className="carousel-title">{current.title}</Text>

      <Text className="complete-subheading">{current.description}</Text>

      <View className="pagination-row">
        {SLIDES.map((slide, idx) => (
          <Pressable
            key={slide.id}
            onPress={() => setSlideIndex(idx)}
            className={`pagination-dot ${idx === slideIndex ? 'pagination-dot-active' : 'pagination-dot-idle'}`}
          />
        ))}
      </View>

      <View className="complete-button-container">
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
