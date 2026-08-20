import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton } from '@/components/ui/buttons';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { RecipeRatingSheet } from './components/recipe-rating-sheet';
import { useRecipeStepImageUrl } from './recipe-image-uploader';
import { type RecipeDetail, type RecipeStep, useRecipeDetail } from './use-recipes';

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

function FinishAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      className="min-h-[62px] rounded-sheet px-[11px] py-[9px] flex-row items-center gap-[10px] bg-background-element/85 active:opacity-75">
      <View className="w-[38px] h-[38px] rounded-control bg-background-selected" />
      <View className="flex-1 min-w-0">
        <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold">
          {title}
        </ThemedText>
        <ThemedText
          type="detail"
          themeColor="textSecondary"
          className="pt-half text-[8px] leading-[10px] font-medium">
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText type="detail" themeColor="textSecondary" className="text-[18px] leading-[20px]">
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
    <View className="flex-1">
      <GradientBackground {...hubGradient} />
      <SafeAreaView
        className="flex-1 w-full max-w-[800px] self-center"
        edges={['top', 'left', 'right']}>
        {/* Header mit Zurück-Button */}
        <PageHeader
          title="Kochmodus"
          leading={<BackButton label="Kochmodus schließen" variant="header" />}
        />
        <ScrollView
          contentContainerClassName="flex-grow px-four pb-four gap-[14px]"
          showsVerticalScrollIndicator={false}>
          {/* Rezepttitel */}
          <ThemedText type="headingSmall" className="pt-[6px]">
            {recipe.title}
          </ThemedText>

          {/* Übersicht aller Zutaten (Basis-Ansicht) */}
          {ingredients.length > 0 ? (
            <View className="rounded-sheet p-[13px] gap-two bg-background-element/85">
              {ingredients.map((item) => {
                const product = item.product_id ? productsById.get(item.product_id) : undefined;
                return (
                  <View key={item.id} className="row-between">
                    <ThemedText type="body">{product?.name ?? 'Zutat'}</ThemedText>
                    <ThemedText type="body" themeColor="textSecondary">
                      {item.quantity ?? item.grams} {item.quantity ? item.unit : 'g'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Allgemeine Kochanleitung */}
          {recipe.instructions ? (
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              className="pt-three text-[12px] leading-[18px] font-medium">
              {recipe.instructions}
            </ThemedText>
          ) : null}

          {/* Statische Liste aller Zubereitungsschritte */}
          {steps.length > 0 ? (
            <View className="gap-three">
              {steps.map((step) => (
                <View key={step.id} className="flex-row gap-two">
                  <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
                    {step.position + 1}.
                  </ThemedText>
                  <ThemedText
                    type="detail"
                    className="flex-1 text-[11px] leading-[18px] font-medium">
                    {step.text}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* Paywall-Button zum Freischalten des geführten Schritt-für-Schritt-Kochmodus */}
          <Pressable
            onPress={unlockPremium}
            role="button"
            className="min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75 mt-auto">
            <ThemedText type="captionCompact" className="text-white font-bold text-center">
              {unlocking ? 'Öffnet…' : 'Geführten Kochmodus freischalten'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function CookingModeScreen() {
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
      <View className="flex-1">
        <GradientBackground {...hubGradient} />
        <SafeAreaView
          className="flex-1 w-full max-w-[800px] self-center"
          edges={['top', 'left', 'right']}>
          <PageHeader title="Kochmodus" leading={<BackButton label="Zurück" variant="header" />} />
          <ThemedText type="caption" themeColor="textSecondary" className="p-six text-center">
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
      <View className="flex-1">
        <GradientBackground {...hubGradient} />
        <SafeAreaView
          className="flex-1 w-full max-w-[800px] self-center"
          edges={['top', 'left', 'right']}>
          {/* Header der Abschlussansicht */}
          <PageHeader
            title="Fertig"
            leading={
              <BackButton
                label="Zurück zum letzten Schritt"
                variant="header"
                onPress={() => setFinished(false)}
              />
            }
          />
          <ScrollView
            contentContainerClassName="flex-grow items-center px-four pt-[38px] pb-six"
            showsVerticalScrollIndicator={false}>
            {/* Erfolgs-Header & Glückwünsche */}
            <View className="w-[82px] h-[82px] rounded-fam-large bg-background-selected" />
            <ThemedText type="headingSmall" className="pt-[18px]">
              Guten Appetit!
            </ThemedText>
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              className="pt-[6px] text-[10px] leading-[13px] font-medium text-center">
              Alles Weitere ist freiwillig und kann übersprungen werden.
            </ThemedText>

            {/* Nachbereitung-Aktionen: Gruppen wiegen, Tagebucheintrag, Bewertung */}
            <View className="w-full gap-two pt-six">
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

            {/* Ohne Angaben schließen */}
            <Pressable
              onPress={() => router.back()}
              role="button"
              className="mt-auto px-[10px] py-three">
              <ThemedText
                type="detail"
                themeColor="textSecondary"
                className="text-[10px] leading-[13px] font-medium">
                Ohne Angaben schließen
              </ThemedText>
            </Pressable>
          </ScrollView>

          {/* Bewertungs-Sheet */}
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
    <View className="flex-1">
      <GradientBackground {...hubGradient} />
      <SafeAreaView
        className="flex-1 w-full max-w-[800px] self-center"
        edges={['top', 'left', 'right']}>
        {/* Header des Kochmodus */}
        <PageHeader
          title="Kochmodus"
          leading={<BackButton label="Kochmodus schließen" variant="header" />}
        />

        {hasSteps && currentStep ? (
          <View className="flex-1 px-four pb-four">
            {/* Schritt-Fortschrittsbalken */}
            <View className="h-[21px] flex-row gap-[5px] pt-half pb-[15px]">
              {steps.map((step, index) => (
                <View
                  key={step.id}
                  className={`flex-1 h-1 rounded-sm ${
                    index <= stepIndex ? 'bg-accent' : 'bg-background-selected'
                  }`}
                />
              ))}
            </View>

            {/* Schrittzähler & Titel */}
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              className="text-[9px] leading-[11px] font-medium tracking-wider">
              SCHRITT {stepIndex + 1} VON {steps.length}
            </ThemedText>
            <ThemedText type="headingSmall" className="pt-[6px]" numberOfLines={2}>
              {currentStep.text.length > 42
                ? `Schritt ${stepIndex + 1}`
                : currentStep.text.replace(/[.!?]+$/, '')}
            </ThemedText>

            {/* Schritt-Grafik / Foto */}
            <View className="h-[184px] mt-[13px] rounded-fam-large overflow-hidden">
              <StepArtwork step={currentStep} />
            </View>
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              className="pt-three text-[12px] leading-[18px] font-medium">
              {currentStep.text}
            </ThemedText>

            {/* Integrierter Timer bei Zeitangaben im Schritt-Text */}
            {parsedDuration ? (
              <View className="min-h-[58px] mt-[14px] rounded-sheet px-[13px] py-three flex-row items-center gap-[5px] bg-background-element/85">
                <View className="flex-1 min-w-0">
                  <ThemedText type="headingSmall">
                    {formatTimer(timerStepId === currentStep.id ? timerSeconds : parsedDuration)}
                  </ThemedText>
                  <ThemedText
                    type="detail"
                    themeColor="textSecondary"
                    className="pt-half text-[8px] leading-[10px] font-medium">
                    {timerSeconds === 0 ? 'Abgelaufen' : timerRunning ? 'Läuft' : 'Pausiert'}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setTimerRunning((running) => !running)}
                  disabled={timerSeconds === 0}
                  role="button"
                  aria-label={timerRunning ? 'Timer pausieren' : 'Timer fortsetzen'}
                  className="w-[34px] h-[34px] rounded-control items-center justify-center bg-background-selected">
                  <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
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
                  className="w-[34px] h-[34px] rounded-control items-center justify-center bg-background-selected">
                  <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
                    ↺
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {/* Navigations-Buttons (Vorheriger Schritt / Nächster Schritt / Fertig) */}
            <View className="mt-auto pt-[13px] flex-row gap-two">
              <Pressable
                onPress={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={stepIndex === 0}
                role="button"
                aria-label="Vorheriger Schritt"
                className={`w-12 h-12 rounded-card items-center justify-center bg-background-selected active:opacity-75 ${
                  stepIndex === 0 ? 'opacity-35' : ''
                }`}>
                <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
                  ‹
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={nextStep}
                role="button"
                className="flex-1 min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75">
                <ThemedText type="captionCompact" className="text-white font-bold text-center">
                  {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Fallback-Ansicht ohne strukturierte Schritte */
          <ScrollView contentContainerClassName="flex-grow px-four pb-four">
            <ThemedText type="headingSmall" className="pt-[6px]">
              {recipe.title}
            </ThemedText>
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              className="pt-three text-[12px] leading-[18px] font-medium">
              {recipe.instructions ?? 'Für dieses Rezept sind noch keine Schritte hinterlegt.'}
            </ThemedText>
            <Pressable
              onPress={() => setFinished(true)}
              role="button"
              className="min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75 mt-auto">
              <ThemedText type="captionCompact" className="text-white font-bold text-center">
                Zubereitung abschließen
              </ThemedText>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
