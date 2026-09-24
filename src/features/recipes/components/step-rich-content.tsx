import { Image } from 'expo-image';
import type { StyleProp, TextStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { rs } from '@/components/theme/index';
import type { TxtVariant } from '@/constants/ui';
import { useRecipeStepImageUrl } from '@/features/recipes/data/household-recipe-images';
import type { MentionableIngredient } from '@/features/recipes/domain/ingredient-mentions';
import { splitStepImageMarkers } from '@/features/recipes/domain/step-image-markers';
import { StepMentionText } from './step-mention-text';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.sm,
  },
  image: {
    width: '100%',
    height: rs(140),
    borderRadius: theme.radius.sm,
  },
}));

export type StepContentImage = {
  key: string;
  path?: string | null;
  uri?: string | null;
  accessibilityLabel?: string;
  testID?: string;
};

interface StepRichContentProps {
  text: string;
  ingredients?: MentionableIngredient[];
  images: readonly StepContentImage[];
  variant?: TxtVariant;
  tone?: 'primary' | 'secondary' | 'accent' | 'danger';
  weight?: TextStyle['fontWeight'];
  textStyle?: StyleProp<TextStyle>;
}

export function StepRichContent({
  text,
  ingredients = [],
  images,
  variant = 'body',
  tone,
  weight,
  textStyle,
}: StepRichContentProps) {
  const segments = splitStepImageMarkers(text, images.length);
  const placedImageIndexes = new Set(
    segments.flatMap((segment) => (segment.kind === 'image' ? [segment.imageIndex] : [])),
  );
  const hasPlacedImages = placedImageIndexes.size > 0;
  const unplacedImages = images.filter((_, index) => !placedImageIndexes.has(index));

  const image = (item: StepContentImage, index: number) => (
    <StepInlineImage key={`${item.key}-${index}`} image={item} />
  );

  return (
    <View style={styles.content}>
      {!hasPlacedImages ? unplacedImages.map((item) => image(item, images.indexOf(item))) : null}
      {segments.map((segment) => {
        if (segment.kind === 'image') {
          return image(images[segment.imageIndex], segment.imageIndex);
        }
        if (!segment.text) return null;
        return (
          <StepMentionText
            key={`text-${segment.text}`}
            text={segment.text}
            ingredients={ingredients}
            variant={variant}
            tone={tone}
            weight={weight}
            style={textStyle}
          />
        );
      })}
      {hasPlacedImages ? unplacedImages.map((item) => image(item, images.indexOf(item))) : null}
    </View>
  );
}

function StepInlineImage({ image }: { image: StepContentImage }) {
  const { data: signedUrl } = useRecipeStepImageUrl(image.uri ? null : image.path);
  const imageUri = image.uri ?? signedUrl;
  if (!imageUri) return null;

  return (
    <Image
      source={{ uri: imageUri }}
      style={styles.image}
      contentFit="cover"
      accessibilityLabel={image.accessibilityLabel}
      testID={image.testID}
    />
  );
}
