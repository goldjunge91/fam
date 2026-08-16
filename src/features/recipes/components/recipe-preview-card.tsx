import { Image } from 'expo-image';
import { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FontSize, ThemedText } from '@/components/themed-text';

import { useRecipeCoverUrl } from '../recipe-cover';

type RecipePreview = {
  title: string;
  coverImagePath?: string | null;
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
        style={StyleSheet.absoluteFill}
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

/**
 * Weicher Verlauf von transparent (oben) zu dunkel (unten) fuer Foto-Karten
 * mit hellem Text-Overlay. Ueber `react-native-svg` statt einer flachen
 * `rgba(...)`-View, weil eine Volltonflaeche eine harte Kante zum Bild
 * erzeugt statt sanft auszublenden — dieselbe Technik wie `GradientBackground`.
 */
function FadeShade({ height }: { height: `${number}%` }) {
  const rawId = useId();
  const gradientId = `card-shade-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
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

/**
 * Die gemeinsame Karte der Rezept-, Favoriten- und Entdecken-Ansichten.
 *
 * Volle Breite statt Zwei-Spalten-Raster, Foto randlos mit Namen/Meta als
 * heller Text auf einem Verlauf am unteren Bildrand (Mockup-Variante B, vom
 * Maintainer ausgewaehlt) — dieselbe Bildsprache wie `RecipeHeroCard`, nur
 * kompakter fuer Listen statt fuer den einzelnen Trending-Einstieg.
 */
export function RecipePreviewCard({
  title,
  coverImagePath,
  cookTimeMinutes,
  difficultyLabel,
  servings,
  onPress,
  paletteIndex,
}: RecipePreviewCardProps) {
  const { data: coverUrl } = useRecipeCoverUrl(coverImagePath);
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <RecipeArtwork
        title={title}
        coverUrl={coverUrl}
        coverPath={coverImagePath}
        paletteIndex={paletteIndex ?? title.length}
      />
      <FadeShade height="62%" />
      <View style={styles.cardCopy}>
        <ThemedText style={styles.cardTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={styles.cardMeta} numberOfLines={1}>
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
  cookTimeMinutes,
  difficultyLabel,
  servings,
  onPress,
  paletteIndex,
  eyebrow = 'Community',
}: RecipeHeroCardProps) {
  const { data: coverUrl } = useRecipeCoverUrl(coverImagePath);
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={title}
      style={({ pressed }) => [styles.hero, pressed && styles.cardPressed]}>
      <RecipeArtwork
        title={title}
        coverUrl={coverUrl}
        coverPath={coverImagePath}
        paletteIndex={paletteIndex ?? title.length}
      />
      <View style={styles.heroShade} />
      <View style={styles.heroCopy}>
        <ThemedText style={styles.heroEyebrow}>{eyebrow}</ThemedText>
        <ThemedText style={styles.heroTitle} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText style={styles.heroMeta} numberOfLines={1}>
          {[meta.left, meta.right].filter(Boolean).join(' · ') || 'Entdecke dieses Rezept'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 200,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  cardCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  cardTitle: {
    color: '#FFFFFF',
    ...FontSize[19],
    lineHeight: 22,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.86)',
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 600,
    marginTop: 3,
  },
  hero: {
    height: 170,
    overflow: 'hidden',
    borderRadius: 23,
    borderCurve: 'continuous',
  },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(38, 29, 41, 0.20)',
  },
  heroCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 15,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    ...FontSize[9],
    lineHeight: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: '#FFFFFF',
    ...FontSize[18],
    lineHeight: 21,
    fontWeight: 700,
    marginTop: 1,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.86)',
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 600,
    marginTop: 3,
  },
});
