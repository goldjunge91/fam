import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { recipeArtworkColors } from '@/components/theme/index';
import { Txt } from '@/constants/ui';

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
          <Stop offset="0%" stopColor={recipeArtworkColors.heroGradient[0]} />
          <Stop offset="58%" stopColor={recipeArtworkColors.heroGradient[1]} />
          <Stop offset="100%" stopColor={recipeArtworkColors.heroGradient[2]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recipe-hero-cover)" />
      <Circle cx="78%" cy="16%" r="30%" fill={recipeArtworkColors.heroWarmGlow} />
      <Circle cx="51%" cy="102%" r="31%" fill={recipeArtworkColors.heroGreenGlow} />
    </Svg>
  );
}

/** Favoriten-Herz im Detail-Header, identisch fuer Rezept und Vorlage. */
export function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <Txt variant="subheading" tone="accent" weight="500">
      {filled ? '♥' : '♡'}
    </Txt>
  );
}
