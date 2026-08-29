import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useRecipeStepImageUrl } from '../../data/household-recipe-images';
import type { RecipeStep } from '../../hooks/use-recipe-steps';

export function CookingModeArtwork({ step }: { step: RecipeStep }) {
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        // expo-image benötigt absoluteFill inline
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        contentFit="cover"
      />
    );
  }

  return (
    <Svg
      width="100%"
      height="100%"
      accessibilityLabel={`Illustration für Schritt ${step.position + 1}`}>
      <Defs>
        <LinearGradient id="cooking-art" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#C98D6D" />
          <Stop offset="100%" stopColor="#E7CAA4" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#cooking-art)" />
      <Circle
        cx="50%"
        cy="68%"
        r="27%"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="14"
      />
    </Svg>
  );
}
