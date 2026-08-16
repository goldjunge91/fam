import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { RecipeRatingSheet } from './components/recipe-rating-sheet';
import { useRecipeStepImageUrl } from './recipe-step-image';
import { type RecipeDetail, type RecipeStep, useRecipeDetail } from './use-recipes';

function BackGlyph() {
  return <ThemedText style={styles.backGlyph}>‹</ThemedText>;
}

function parseStepDurationSeconds(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\b(\d{1,3})\s*(?:min(?:ute)?n?)\b/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  return minutes > 0 ? minutes * 60 : null;
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function StepArtwork({ step }: { step: RecipeStep }) {
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />;
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

function FinishAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      role="button"
      style={({ pressed }) => [
        styles.finishAction,
        { backgroundColor: `${theme.backgroundElement}D6` },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.finishActionIcon, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.finishActionCopy}>
        <ThemedText style={styles.finishActionTitle}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.finishActionSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.finishChevron}>
        ›
      </ThemedText>
    </Pressable>
  );
}

/**
 * Kochmodus-Basis-Ansicht (#133, kostenlose Stufe): reiner Lese-Screen mit
 * Zutatenliste, Basis-Rezepttext und nummerierten Schritten. Bewusst kein
 * interaktiver Schritt-fuer-Schritt-Ablauf und kein Timer — das bleibt
 * Premium (#134/#135), siehe `CookingModeScreen` und `BENEFITS` in
 * `premium-screen.tsx`.
 */
function FreeCookingMode({ data }: { data: RecipeDetail }) {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { recipe, items, steps, productsById } = data;
  const ingredients = items.filter((item) => item.product_id !== null);
  const [unlocking, setUnlocking] = useState(false);

  async function unlockPremium() {
    setUnlocking(true);
    try {
      await presentPaywallIfNeeded();
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Kochmodus"
          leading={
            <HeaderIconButton label="Kochmodus schließen" onPress={() => router.back()}>
              <BackGlyph />
            </HeaderIconButton>
          }
        />
        <ScrollView contentContainerStyle={styles.freeContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.stepTitle}>{recipe.title}</ThemedText>

          {ingredients.length > 0 ? (
            <View style={[styles.freeCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
              {ingredients.map((item) => {
                const product = item.product_id ? productsById.get(item.product_id) : undefined;
                return (
                  <View key={item.id} style={styles.freeIngredientRow}>
                    <ThemedText>{product?.name ?? 'Zutat'}</ThemedText>
                    <ThemedText themeColor="textSecondary">
                      {item.quantity ?? item.grams} {item.quantity ? item.unit : 'g'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ) : null}

          {recipe.instructions ? (
            <ThemedText themeColor="textSecondary" style={styles.stepDescription}>
              {recipe.instructions}
            </ThemedText>
          ) : null}

          {steps.length > 0 ? (
            <View style={styles.freeStepsList}>
              {steps.map((step) => (
                <View key={step.id} style={styles.freeStepRow}>
                  <ThemedText themeColor="accent" style={styles.freeStepNumber}>
                    {step.position + 1}.
                  </ThemedText>
                  <ThemedText style={styles.freeStepText}>{step.text}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={unlockPremium}
            role="button"
            style={({ pressed }) => [
              styles.nextButton,
              styles.fallbackButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.nextButtonText}>
              {unlocking ? 'Öffnet…' : 'Geführten Kochmodus freischalten'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function CookingModeScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useRecipeDetail(id);
  const { isPremium } = usePremium();
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [timerStepId, setTimerStepId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStep = data?.steps[Math.min(stepIndex, Math.max((data?.steps.length ?? 0) - 1, 0))];
  const parsedDuration = parseStepDurationSeconds(timerStep?.text);

  useEffect(() => {
    if (!timerStep || timerStep.id === timerStepId) return;
    setTimerStepId(timerStep.id);
    setTimerSeconds(parsedDuration ?? 0);
    setTimerRunning(false);
  }, [parsedDuration, timerStep, timerStepId]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  if (isLoading || !data) {
    return (
      <View style={styles.root}>
        <GradientBackground {...hubGradient} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <PageHeader
            title="Kochmodus"
            leading={
              <HeaderIconButton label="Zurück" onPress={() => router.back()}>
                <BackGlyph />
              </HeaderIconButton>
            }
          />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Kochmodus wird geladen…
          </ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  if (!isPremium) {
    return <FreeCookingMode data={data} />;
  }

  const { recipe, steps } = data;
  const hasSteps = steps.length > 0;
  const currentStep = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];

  function nextStep() {
    if (stepIndex >= steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((value) => value + 1);
  }

  if (finished) {
    return (
      <View style={styles.root}>
        <GradientBackground {...hubGradient} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <PageHeader
            title="Fertig"
            leading={
              <HeaderIconButton
                label="Zurück zum letzten Schritt"
                onPress={() => setFinished(false)}>
                <BackGlyph />
              </HeaderIconButton>
            }
          />
          <ScrollView
            contentContainerStyle={styles.finishContent}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.finishArtwork, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText style={styles.finishTitle}>Guten Appetit!</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.finishSubtitle}>
              Alles Weitere ist freiwillig und kann übersprungen werden.
            </ThemedText>

            <View style={styles.finishActions}>
              <FinishAction
                title="Zubereitete Gruppen wiegen"
                subtitle="Werte im eigenen Rezept verbessern"
                onPress={() =>
                  router.push({
                    pathname: '/recipe/log',
                    params: { id: recipe.id, mode: 'weigh' },
                  })
                }
              />
              <FinishAction
                title="Ins Tagebuch eintragen"
                subtitle="Portionsmengen getrennt anpassen"
                onPress={() => router.push({ pathname: '/recipe/log', params: { id: recipe.id } })}
              />
              <FinishAction
                title="Rezept bewerten"
                subtitle="1–10 Sterne und optionaler Text"
                onPress={() => setRatingOpen(true)}
              />
            </View>

            <Pressable onPress={() => router.back()} role="button" style={styles.closeLink}>
              <ThemedText themeColor="textSecondary" style={styles.closeLinkText}>
                Ohne Angaben schließen
              </ThemedText>
            </Pressable>
          </ScrollView>
          <RecipeRatingSheet
            recipeId={recipe.id}
            visible={ratingOpen}
            onClose={() => setRatingOpen(false)}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Kochmodus"
          leading={
            <HeaderIconButton label="Kochmodus schließen" onPress={() => router.back()}>
              <BackGlyph />
            </HeaderIconButton>
          }
        />

        {hasSteps && currentStep ? (
          <View style={styles.cookContent}>
            <View style={styles.progressRow}>
              {steps.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: index <= stepIndex ? theme.accent : theme.backgroundSelected,
                    },
                  ]}
                />
              ))}
            </View>

            <ThemedText themeColor="textSecondary" style={styles.stepEyebrow}>
              SCHRITT {stepIndex + 1} VON {steps.length}
            </ThemedText>
            <ThemedText style={styles.stepTitle} numberOfLines={2}>
              {currentStep.text.length > 42
                ? `Schritt ${stepIndex + 1}`
                : currentStep.text.replace(/[.!?]+$/, '')}
            </ThemedText>

            <View style={styles.stepArtwork}>
              <StepArtwork step={currentStep} />
            </View>
            <ThemedText themeColor="textSecondary" style={styles.stepDescription}>
              {currentStep.text}
            </ThemedText>

            {parsedDuration ? (
              <View style={[styles.timerCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
                <View style={styles.timerCopy}>
                  <ThemedText style={styles.timerValue}>
                    {formatTimer(timerStepId === currentStep.id ? timerSeconds : parsedDuration)}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.timerStatus}>
                    {timerSeconds === 0 ? 'Abgelaufen' : timerRunning ? 'Läuft' : 'Pausiert'}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setTimerRunning((running) => !running)}
                  disabled={timerSeconds === 0}
                  role="button"
                  aria-label={timerRunning ? 'Timer pausieren' : 'Timer fortsetzen'}
                  style={[styles.timerButton, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText themeColor="accent" style={styles.timerButtonText}>
                    {timerRunning ? 'Ⅱ' : '▶'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setTimerSeconds(parsedDuration);
                    setTimerRunning(false);
                  }}
                  role="button"
                  aria-label="Timer zurücksetzen"
                  style={[styles.timerButton, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText themeColor="accent" style={styles.timerButtonText}>
                    ↺
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.footerActions}>
              <Pressable
                onPress={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={stepIndex === 0}
                role="button"
                aria-label="Vorheriger Schritt"
                style={({ pressed }) => [
                  styles.previousButton,
                  { backgroundColor: theme.backgroundSelected },
                  stepIndex === 0 && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <ThemedText themeColor="accent" style={styles.previousGlyph}>
                  ‹
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={nextStep}
                role="button"
                style={({ pressed }) => [
                  styles.nextButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.nextButtonText}>
                  {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.fallbackContent}>
            <ThemedText style={styles.stepTitle}>{recipe.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.stepDescription}>
              {recipe.instructions ?? 'Für dieses Rezept sind noch keine Schritte hinterlegt.'}
            </ThemedText>
            <Pressable
              onPress={() => setFinished(true)}
              role="button"
              style={[styles.nextButton, styles.fallbackButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.nextButtonText}>Zubereitung abschließen</ThemedText>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  loadingText: { padding: 24, textAlign: 'center', ...FontSize[12] },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  cookContent: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  progressRow: { height: 21, flexDirection: 'row', gap: 5, paddingTop: 2, paddingBottom: 15 },
  progressSegment: { flex: 1, height: 4, borderRadius: Radius.hairline },
  stepEyebrow: { ...FontSize[9], lineHeight: 11, fontWeight: 500, letterSpacing: 0.67 },
  stepTitle: {
    paddingTop: 6,
    ...FontSize[23],
    lineHeight: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  stepArtwork: {
    height: 184,
    marginTop: 13,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  stepDescription: { paddingTop: 14, ...FontSize[12], lineHeight: 18, fontWeight: 500 },
  timerCard: {
    minHeight: 58,
    marginTop: 14,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerCopy: { flex: 1, minWidth: 0 },
  timerValue: { ...FontSize[19], lineHeight: 22, fontWeight: 700, letterSpacing: -0.45 },
  timerStatus: { paddingTop: 2, ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  timerButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonText: { ...FontSize[12], lineHeight: 15, fontWeight: 700 },
  footerActions: { marginTop: 'auto', paddingTop: 13, flexDirection: 'row', gap: 8 },
  previousButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousGlyph: { ...FontSize[24], lineHeight: 27, fontWeight: 500 },
  nextButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  nextButtonText: {
    color: '#FFFFFF',
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  fallbackContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },
  fallbackButton: { flex: 0, marginTop: 'auto' },
  freeContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  freeCard: { borderRadius: Radius.sheet, borderCurve: 'continuous', padding: 13, gap: 8 },
  freeIngredientRow: { flexDirection: 'row', justifyContent: 'space-between' },
  freeStepsList: { gap: 12 },
  freeStepRow: { flexDirection: 'row', gap: 8 },
  freeStepNumber: { ...FontSize[11], fontWeight: 700 },
  freeStepText: { flex: 1, ...FontSize[11], lineHeight: 18, fontWeight: 500 },
  finishContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 38,
    paddingBottom: 24,
  },
  finishArtwork: { width: 82, height: 82, borderRadius: Radius.large, borderCurve: 'continuous' },
  finishTitle: { paddingTop: 18, ...FontSize[23], lineHeight: 28, fontWeight: 700 },
  finishSubtitle: {
    paddingTop: 6,
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 500,
    textAlign: 'center',
  },
  finishActions: { width: '100%', gap: 8, paddingTop: 24 },
  finishAction: {
    minHeight: 62,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  finishActionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  finishActionCopy: { flex: 1, minWidth: 0 },
  finishActionTitle: { ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  finishActionSubtitle: { paddingTop: 2, ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  finishChevron: { ...FontSize[18], lineHeight: 20 },
  closeLink: { marginTop: 'auto', paddingHorizontal: 10, paddingVertical: 12 },
  closeLinkText: { ...FontSize[10], lineHeight: 13, fontWeight: 500 },
});
