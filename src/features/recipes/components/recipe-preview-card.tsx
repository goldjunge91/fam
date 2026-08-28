import { Image } from 'expo-image';
import { useId } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/theme/themed-text';
import { useCatalogImageUrl } from '../catalog/use-recipe-catalog';
import { useRecipeCoverUrl } from '../data/household-recipe-images';

type RecipePreview = {
  title: string;
  coverImagePath?: string | null;
  coverSource?: 'household' | 'catalog';
  cookTimeMinutes?: number | null;
  difficultyLabel?: string | null;
  servings?: number | null;
};

type RecipePreviewCardProps = RecipePreview & {
  onPress: () => void;
  paletteIndex?: number;
};

const PALETTES = [
  ['#7A927C', '#D2C89B'],
  ['#B77857', '#EFD2A7'],
  ['#977593', '#E3C5BD'],
  ['#7E718F', '#C8B9D8'],
  ['#89966E', '#D6C99A'],
] as const;

/** Bild-Kachel mit Farbverlauf-Fallback ohne Cover — auch fuer den Drag-Tray des Essensplans. */
export function RecipeArtwork({
  coverUrl,
  coverPath,
  title,
  paletteIndex = 0,
}: {
  coverUrl?: string | null;
  coverPath?: string | null;
  title: string;
  paletteIndex?: number;
}) {
  const rawId = useId();
  const gradientId = `recipe-art-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const palette = PALETTES[Math.abs(paletteIndex) % PALETTES.length];
  const source = coverUrl ? { uri: coverUrl } : null;

  if (source) {
    return (
      <Image
        source={source}
        contentFit="cover"
        transition={180}
        // expo-image unterstützt kein NativeWind className für absolute Fill
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        accessibilityLabel={`Bild von ${title}`}
        onLoad={({ cacheType, source: loadedSource }) => {
          if (__DEV__) {
            console.log('[RecipeCover] image:success', {
              title,
              path: coverPath ?? null,
              cacheType,
              width: loadedSource.width,
              height: loadedSource.height,
              mediaType: loadedSource.mediaType,
            });
          }
        }}
        onError={({ error }) => {
          if (__DEV__) {
            console.log('[RecipeCover] image:error', {
              title,
              path: coverPath ?? null,
              message: error,
            });
          }
        }}
      />
    );
  }

  return (
    <Svg width="100%" height="100%" accessibilityLabel={`Illustration für ${title}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={palette[0]} />
          <Stop offset="100%" stopColor={palette[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      <Circle cx="50%" cy="59%" r="34%" fill="rgba(255,255,255,0.14)" />
      <Circle
        cx="50%"
        cy="59%"
        r="27%"
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.58)"
        strokeWidth="9"
      />
    </Svg>
  );
}

function FadeShade({ height }: { height: `${number}%` }) {
  const rawId = useId();
  const gradientId = `card-shade-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    // react-native-svg Svg-Wurzel benötigt inline-Positionierung
    <Svg
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      width="100%"
      height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#140e10" stopOpacity={0} />
          <Stop offset="100%" stopColor="#140e10" stopOpacity={0.78} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function formatMeta({
  cookTimeMinutes,
  difficultyLabel,
  servings,
}: Pick<RecipePreview, 'cookTimeMinutes' | 'difficultyLabel' | 'servings'>) {
  const left = [cookTimeMinutes ? `${cookTimeMinutes} Min` : null, difficultyLabel]
    .filter(Boolean)
    .join(' · ');
  const right = servings ? `${servings} Port.` : null;
  return { left, right };
}

export function RecipePreviewCard({
  title,
  coverImagePath,
  coverSource = 'household',
  cookTimeMinutes,
  difficultyLabel,
  servings,
  onPress,
  paletteIndex,
}: RecipePreviewCardProps) {
  const householdCover = useRecipeCoverUrl(coverSource === 'household' ? coverImagePath : null);
  const catalogCover = useCatalogImageUrl(coverSource === 'catalog' ? coverImagePath : null);
  const coverUrl = coverSource === 'catalog' ? catalogCover.data : householdCover.data;
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Pressable onPress={onPress} role="button" aria-label={title} className="recipe-preview-card">
      <RecipeArtwork
        title={title}
        coverUrl={coverUrl}
        coverPath={coverImagePath}
        paletteIndex={paletteIndex ?? title.length}
      />
      <FadeShade height="62%" />
      <View className="card-copy-bottom">
        <ThemedText
          className="text-white text-[19px] leading-[22px] font-bold tracking-tight"
          numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText
          type="captionCompact"
          className="text-white/85 font-semibold mt-[3px]"
          numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Rezept'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

type RecipeHeroCardProps = RecipePreviewCardProps & {
  eyebrow?: string;
};

/** Grosses Einstiegsrezept; verwendet dieselben Daten und Bild-Fallbacks wie die Rasterkarte. */
export function RecipeHeroCard({
  title,
  coverImagePath,
  coverSource = 'household',
  cookTimeMinutes,
  difficultyLabel,
  servings,
  onPress,
  paletteIndex,
  eyebrow = 'Community',
}: RecipeHeroCardProps) {
  const householdCover = useRecipeCoverUrl(coverSource === 'household' ? coverImagePath : null);
  const catalogCover = useCatalogImageUrl(coverSource === 'catalog' ? coverImagePath : null);
  const coverUrl = coverSource === 'catalog' ? catalogCover.data : householdCover.data;
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Pressable onPress={onPress} role="button" aria-label={title} className="recipe-hero-card">
      <RecipeArtwork
        title={title}
        coverUrl={coverUrl}
        coverPath={coverImagePath}
        paletteIndex={paletteIndex ?? title.length}
      />
      <View className="absolute inset-0 bg-[#261d29]/20" />
      <View className="card-copy-bottom">
        <ThemedText className="text-white/80 text-[9px] leading-[12px] font-bold uppercase tracking-widest">
          {eyebrow}
        </ThemedText>
        <ThemedText
          className="text-white text-[18px] leading-[21px] font-bold mt-half"
          numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText
          type="detail"
          className="text-white/85 text-[10px] leading-[13px] font-semibold mt-[3px]"
          numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Entdecke dieses Rezept'}
        </ThemedText>
      </View>
    </Pressable>
  );
}
