import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useRecipeFavorites } from '@/features/recipes/recipe-favorites';
import { useRecipeCoverUrl } from '@/features/recipes/recipe-image-uploader';
import {
  DIETARY_TAGS,
  DIFFICULTIES,
  DISH_TYPES,
} from '@/features/recipes/wizard/recipe-metadata-options';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { useApplyRecipeTemplateMutation, useRecipeTemplateDetail } from './use-recipe-templates';

const DIFFICULTY_LABELS = Object.fromEntries(DIFFICULTIES.map((item) => [item.value, item.label]));
const DISH_TYPE_LABELS = Object.fromEntries(DISH_TYPES.map((item) => [item.value, item.label]));
const DIETARY_TAG_LABELS = Object.fromEntries(DIETARY_TAGS.map((item) => [item.value, item.label]));

function BackGlyph() {
  return <ThemedText style={styles.backGlyph}>‹</ThemedText>;
}

function HeartGlyph({ filled }: { filled: boolean }) {
  const theme = useTheme();
  return (
    <ThemedText style={[styles.heartGlyph, { color: theme.accent }]}>
      {filled ? '♥' : '♡'}
    </ThemedText>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.metaPill, { backgroundColor: `${theme.backgroundElement}D6` }]}>
      <ThemedText themeColor="textSecondary" style={styles.metaPillText}>
        {children}
      </ThemedText>
    </View>
  );
}

function HeroArtwork({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
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
        <LinearGradient id="template-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#D3A06F" />
          <Stop offset="58%" stopColor="#8A696C" />
          <Stop offset="100%" stopColor="#574458" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#template-cover)" />
      <Circle cx="78%" cy="16%" r="30%" fill="rgba(255,226,187,0.30)" />
      <Circle cx="51%" cy="102%" r="31%" fill="rgba(101,150,111,0.30)" />
    </Svg>
  );
}

export function RecipeTemplateDetailScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const [isApplying, setIsApplying] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const { data: template, isLoading } = useRecipeTemplateDetail(id);
  const { data: coverUrl } = useRecipeCoverUrl(template?.cover_image_path);
  const applyTemplate = useApplyRecipeTemplateMutation();
  const { isFavorite, toggleFavorite } = useRecipeFavorites();
  const favorite = isFavorite(`template:${id}`);

  async function copyTemplate() {
    if (!template || !activeHouseholdId || !session?.user.id) return;
    setIsApplying(true);
    try {
      const recipe = await applyTemplate.mutateAsync({
        template,
        household_id: activeHouseholdId,
        created_by: session.user.id,
      });
      router.replace({ pathname: '/recipe/detail', params: { id: recipe.id } });
    } catch (error) {
      Alert.alert(
        'Rezept konnte nicht übernommen werden',
        error instanceof Error ? error.message : 'Bitte versuche es erneut.',
      );
    } finally {
      setIsApplying(false);
    }
  }

  if (isLoading || !template) {
    return (
      <View style={styles.root}>
        <GradientBackground {...hubGradient} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <PageHeader
            title="Rezept"
            leading={
              <HeaderIconButton label="Zurück" onPress={() => router.back()}>
                <BackGlyph />
              </HeaderIconButton>
            }
          />
          <ActivityIndicator style={styles.loading} color={theme.accent} />
        </SafeAreaView>
      </View>
    );
  }

  const currentServings = servings ?? template.default_servings;
  const scale = currentServings / Math.max(1, template.default_servings);
  const tags = [...template.dish_types, ...template.dietary_tags];

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Rezept"
          leading={
            <HeaderIconButton label="Zurück" onPress={() => router.back()}>
              <BackGlyph />
            </HeaderIconButton>
          }
          trailing={
            <HeaderIconButton
              label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
              onPress={() => toggleFavorite(`template:${id}`)}>
              <HeartGlyph filled={favorite} />
            </HeaderIconButton>
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <HeroArtwork coverUrl={coverUrl} title={template.title} />
            <View style={[styles.heroBadge, { backgroundColor: `${theme.backgroundElement}E8` }]}>
              <ThemedText themeColor="accent" style={styles.heroBadgeText}>
                Entdecken
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.title}>{template.title}</ThemedText>
          <View style={styles.metaRow}>
            {template.cook_time_minutes ? (
              <MetaPill>{template.cook_time_minutes} Minuten</MetaPill>
            ) : null}
            {template.difficulty ? (
              <MetaPill>{DIFFICULTY_LABELS[template.difficulty]}</MetaPill>
            ) : null}
            {tags.map((tag) => (
              <MetaPill key={tag}>
                {DISH_TYPE_LABELS[tag] ?? DIETARY_TAG_LABELS[tag] ?? tag}
              </MetaPill>
            ))}
          </View>

          {template.instructions ? (
            <ThemedText themeColor="textSecondary" style={styles.description}>
              {template.instructions}
            </ThemedText>
          ) : null}

          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Zutaten</ThemedText>
            <View
              style={[styles.portionControl, { backgroundColor: `${theme.backgroundElement}D6` }]}>
              <Pressable
                onPress={() => setServings(Math.max(1, currentServings - 1))}
                role="button"
                aria-label="Weniger Portionen"
                style={styles.portionButton}>
                <ThemedText themeColor="accent" style={styles.portionSign}>
                  −
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.portionValue}>{currentServings} Portionen</ThemedText>
              <Pressable
                onPress={() => setServings(currentServings + 1)}
                role="button"
                aria-label="Mehr Portionen"
                style={styles.portionButton}>
                <ThemedText themeColor="accent" style={styles.portionSign}>
                  +
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.groupList}>
            {template.components.map((component) => (
              <View
                key={component.id}
                style={[
                  styles.ingredientGroup,
                  { backgroundColor: `${theme.backgroundElement}D6` },
                ]}>
                <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
                  <ThemedText style={styles.groupTitle}>{component.name}</ThemedText>
                  {component.serving_grams !== null ? (
                    <ThemedText themeColor="textSecondary" style={styles.groupMeta}>
                      {Math.round(component.serving_grams * scale)} g
                    </ThemedText>
                  ) : null}
                </View>
                {component.items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.ingredientRow,
                      index < component.items.length - 1 && {
                        borderBottomColor: theme.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <ThemedText style={styles.ingredientName} numberOfLines={1}>
                      {item.product_name ?? 'Zutat'}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.ingredientAmount}>
                      {Math.round((item.quantity ?? item.grams) * scale)} {item.unit}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Zubereitung</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sectionCount}>
              {template.steps.length} {template.steps.length === 1 ? 'Schritt' : 'Schritte'}
            </ThemedText>
          </View>
          {template.steps.length > 0 ? (
            <View style={[styles.stepsCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
              {template.steps.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.stepRow,
                    index < template.steps.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <ThemedText style={styles.stepText}>
                    {step.position + 1}. {step.text}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.stickyAction}>
          <Pressable
            onPress={copyTemplate}
            disabled={isApplying || !activeHouseholdId || !session}
            role="button"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.accent },
              (isApplying || !activeHouseholdId || !session) && styles.disabled,
              pressed && styles.pressed,
            ]}>
            {isApplying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="captionCompact" style={styles.primaryButtonText}>
                In meine Rezepte übernehmen
              </ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  loading: { marginTop: 60 },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  heartGlyph: { ...FontSize[24], lineHeight: 27, fontWeight: 500 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 15, paddingBottom: 96 },
  hero: { height: 205, marginHorizontal: -15, overflow: 'hidden' },
  heroBadge: {
    position: 'absolute',
    top: 14,
    left: 15,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  heroBadgeText: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  title: {
    paddingTop: 15,
    ...FontSize[22],
    lineHeight: 26,
    fontWeight: 700,
    letterSpacing: -0.7,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 5 },
  metaPill: {
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaPillText: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  description: { paddingTop: 12, ...FontSize[10], lineHeight: 15, fontWeight: 500 },
  sectionHeading: {
    minHeight: 52,
    paddingTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { ...FontSize[13], lineHeight: 16, fontWeight: 700 },
  sectionCount: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  portionControl: {
    width: 138,
    height: 35,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionButton: { width: 34, height: 35, alignItems: 'center', justifyContent: 'center' },
  portionSign: { ...FontSize[15], lineHeight: 18, fontWeight: 500 },
  portionValue: {
    flex: 1,
    textAlign: 'center',
    ...FontSize[9],
    lineHeight: 11,
    fontWeight: 500,
  },
  groupList: { gap: 9 },
  ingredientGroup: { borderRadius: Radius.sheet, borderCurve: 'continuous', overflow: 'hidden' },
  groupHeader: {
    minHeight: 33,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: { flex: 1, ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  groupMeta: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  ingredientRow: {
    minHeight: 28,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ingredientName: { flex: 1, ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  ingredientAmount: { ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  stepsCard: { borderRadius: Radius.sheet, borderCurve: 'continuous', overflow: 'hidden' },
  stepRow: { minHeight: 28, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  stepText: { ...FontSize[9], lineHeight: 13, fontWeight: 500 },
  stickyAction: { position: 'absolute', left: 15, right: 15, bottom: 12 },
  primaryButton: {
    minHeight: 48,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: 700 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
