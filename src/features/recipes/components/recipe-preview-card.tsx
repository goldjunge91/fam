import { Image } from 'expo-image';
import { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FontSize, ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

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
  title,
  paletteIndex = 0,
}: {
  coverUrl?: string | null;
  title: string;
  paletteIndex?: number;
}) {
  const rawId = useId();
  const gradientId = `recipe-art-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const palette = PALETTES[Math.abs(paletteIndex) % PALETTES.length];

  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        contentFit="cover"
        transition={180}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`Bild von ${title}`}
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

/** Die gemeinsame Rasterkarte der Rezept-, Favoriten- und Entdecken-Ansichten. */
export function RecipePreviewCard({
  title,
  coverImagePath,
  cookTimeMinutes,
  difficultyLabel,
  servings,
  onPress,
  paletteIndex,
}: RecipePreviewCardProps) {
  const theme = useTheme();
  const { data: coverUrl } = useRecipeCoverUrl(coverImagePath);
  const meta = formatMeta({ cookTimeMinutes, difficultyLabel, servings });

  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={title}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: `${theme.backgroundElement}E8` },
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.artwork}>
        <RecipeArtwork
          title={title}
          coverUrl={coverUrl}
          paletteIndex={paletteIndex ?? title.length}
        />
      </View>
      <View style={styles.body}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
            {meta.left || 'Rezept'}
          </ThemedText>
          {meta.right ? (
            <ThemedText themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
              {meta.right}
            </ThemedText>
          ) : null}
        </View>
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
    flex: 1,
    minWidth: '46%',
    maxWidth: '49%',
    height: 132,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 6,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  artwork: {
    height: 84,
    overflow: 'hidden',
    borderRadius: 13,
    borderCurve: 'continuous',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingTop: 4,
  },
  title: {
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 700,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  meta: {
    flexShrink: 1,
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: 500,
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
