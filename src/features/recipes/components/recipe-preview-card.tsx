import { Image } from 'expo-image';
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { recipeArtworkColors, rs } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';
import { debugError, debugLog } from '@/lib/observability/debug-log';
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
};

const RECIPE_IMAGE_LOG_DEBOUNCE_MS = 250;

const styles = StyleSheet.create((theme) => ({
  previewContainer: {
    width: '100%',
    height: rs(200),
  },
  previewCard: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  heroContainer: {
    width: '100%',
    height: rs(170),
  },
  heroCard: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.famLarge,
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.shadowSheet,
    opacity: 0.2,
  },
  copy: {
    position: 'absolute',
    right: rs(24),
    bottom: rs(14),
    left: rs(24),
  },
  meta: {
    marginTop: theme.space.md,
    opacity: 0.85,
  },
  eyebrow: {
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  heroTitle: {
    marginTop: theme.space.md,
  },
}));

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

  debugLog('[RecipeCover] images:loaded', {
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

/** Bild-Kachel mit Farbverlauf-Fallback ohne Cover. */
export function RecipeArtwork({
  coverUrl,
  coverPath,
  title,
  testID,
}: {
  coverUrl?: string | null;
  coverPath?: string | null;
  title: string;
  testID?: string;
}) {
  const rawId = useId();
  const gradientId = `recipe-art-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const source = coverUrl ? { uri: coverUrl } : null;

  if (source) {
    return (
      <Image
        testID={testID}
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
            debugError('[RecipeCover] image:error', {
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
          <Stop offset="0%" stopColor={recipeArtworkColors.previewPalette[0]} />
          <Stop offset="100%" stopColor={recipeArtworkColors.previewPalette[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      <Circle cx="50%" cy="59%" r="34%" fill={recipeArtworkColors.previewHighlight} />
      <Circle
        cx="50%"
        cy="59%"
        r="27%"
        fill={recipeArtworkColors.previewHighlightSoft}
        stroke={recipeArtworkColors.previewHighlightBorder}
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
          <Stop offset="0%" stopColor={recipeArtworkColors.previewOverlay} stopOpacity={0} />
          <Stop offset="100%" stopColor={recipeArtworkColors.previewOverlay} stopOpacity={0.78} />
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
}: RecipePreviewCardProps) {
  const householdCover = useRecipeCoverUrl(coverSource === 'household' ? coverImagePath : null);
  const catalogCover = useCatalogImageUrl(coverSource === 'catalog' ? coverImagePath : null);
  const coverUrl = coverSource === 'catalog' ? catalogCover.data : householdCover.data;
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Press
      onPress={onPress}
      role="button"
      aria-label={title}
      containerStyle={styles.previewContainer}
      style={styles.previewCard}>
      <RecipeArtwork title={title} coverUrl={coverUrl} coverPath={coverImagePath} />
      <FadeShade height="62%" />
      <View style={styles.copy}>
        <Txt variant="subheading" tone="onAccent" weight="700" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="caption" tone="onAccent" weight="600" style={styles.meta} numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Rezept'}
        </Txt>
      </View>
    </Press>
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
  eyebrow = 'Community',
}: RecipeHeroCardProps) {
  const householdCover = useRecipeCoverUrl(coverSource === 'household' ? coverImagePath : null);
  const catalogCover = useCatalogImageUrl(coverSource === 'catalog' ? coverImagePath : null);
  const coverUrl = coverSource === 'catalog' ? catalogCover.data : householdCover.data;
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Press
      onPress={onPress}
      role="button"
      aria-label={title}
      containerStyle={styles.heroContainer}
      style={styles.heroCard}>
      <RecipeArtwork title={title} coverUrl={coverUrl} coverPath={coverImagePath} />
      <View style={styles.heroOverlay} />
      <View style={styles.copy}>
        <Txt variant="eyebrow" tone="onAccent" weight="700" style={styles.eyebrow}>
          {eyebrow}
        </Txt>
        <Txt variant="body" tone="onAccent" weight="700" style={styles.heroTitle} numberOfLines={2}>
          {title}
        </Txt>
        <Txt variant="caption" tone="onAccent" weight="600" style={styles.meta} numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Entdecke dieses Rezept'}
        </Txt>
      </View>
    </Press>
  );
}
