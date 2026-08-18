import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';

/**
 * Deckbild fuer Rezept- und Vorlagendetail: echtes Cover-Foto, sonst ein
 * warmer Verlauf mit denselben Farbstopps als Platzhalter. Vorher unabhaengig
 * in `recipe-detail-screen.tsx` und `templates/recipe-template-detail-screen.tsx`
 * dupliziert (#154).
 */
export function HeroArtwork({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel={`Bild von ${title}`}
      />
    );
  }

  return (
    <Svg width="100%" height="100%" accessibilityLabel={`Illustration für ${title}`}>
      <Defs>
        <LinearGradient id="recipe-hero-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#D3A06F" />
          <Stop offset="58%" stopColor="#8A696C" />
          <Stop offset="100%" stopColor="#574458" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recipe-hero-cover)" />
      <Circle cx="78%" cy="16%" r="30%" fill="rgba(255,226,187,0.30)" />
      <Circle cx="51%" cy="102%" r="31%" fill="rgba(101,150,111,0.30)" />
    </Svg>
  );
}

/** Favoriten-Herz im Detail-Header, identisch fuer Rezept und Vorlage. */
export function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <ThemedText themeColor="accent" className="text-[24px] leading-[27px] font-medium">
      {filled ? '♥' : '♡'}
    </ThemedText>
  );
}
