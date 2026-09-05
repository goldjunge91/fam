import { Image } from 'expo-image';
import { useId } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Txt } from '@/constants/ui';
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

const RECIPE_IMAGE_LOG_DEBOUNCE_MS = 250;

type RecipeImageLoad = {
  title: string;
  cacheType: string;
};

let pendingRecipeImageLoads: RecipeImageLoad[] = [];
let recipeImageLogTimer: ReturnType<typeof setTimeout> | null = null;

function flushRecipeImageLoadLog() {
  if (pendingRecipeImageLoads.length === 0) return;

  const loads = pendingRecipeImageLoads;
  pendingRecipeImageLoads = [];
  recipeImageLogTimer = null;

  const titles = new Map<string, number>();
  const cacheTypes = new Map<string, number>();
  for (const { title, cacheType } of loads) {
    titles.set(title, (titles.get(title) ?? 0) + 1);
    cacheTypes.set(cacheType, (cacheTypes.get(cacheType) ?? 0) + 1);
  }

  console.log('[RecipeCover] images:loaded', {
    count: loads.length,
    uniqueTitles: titles.size,
    titles: Object.fromEntries(titles),
    cacheTypes: Object.fromEntries(cacheTypes),
  });
}

export function logRecipeImageLoaded(load: RecipeImageLoad) {
  if (!__DEV__) return;

  pendingRecipeImageLoads.push(load);
  if (recipeImageLogTimer) clearTimeout(recipeImageLogTimer);
  recipeImageLogTimer = setTimeout(flushRecipeImageLoadLog, RECIPE_IMAGE_LOG_DEBOUNCE_MS);
}

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
        onLoad={({ cacheType }) => {
          logRecipeImageLoaded({ title, cacheType });
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
        <Txt
          variant="subheading"
          tone="inverse"
          weight="700"
          className="tracking-tight"
          numberOfLines={1}>
          {title}
        </Txt>
        <Txt
          variant="caption"
          tone="inverse"
          weight="600"
          className="mt-[3px]"
          style={{ opacity: 0.85 }}
          numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Rezept'}
        </Txt>
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
        <Txt
          variant="caption"
          tone="inverse"
          weight="700"
          className="uppercase tracking-widest"
          style={{ opacity: 0.8 }}>
          {eyebrow}
        </Txt>
        <Txt variant="body" tone="inverse" weight="700" className="mt-half" numberOfLines={2}>
          {title}
        </Txt>
        <Txt
          variant="caption"
          tone="inverse"
          weight="600"
          className="mt-[3px]"
          style={{ opacity: 0.85 }}
          numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Entdecke dieses Rezept'}
        </Txt>
      </View>
    </Pressable>
  );
}
