import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { MentionableIngredient } from '../../domain/ingredient-mentions';
import { splitStepImageMarkers } from '../../domain/step-image-markers';
import type { CookingModeVoice } from '../../hooks/use-cooking-mode-voice';
import type { RecipeStep } from '../../hooks/use-recipe-steps';
import { StepRichContent } from '../step-rich-content';
import { CookingModeArtwork } from './cooking-mode-artwork';
import { CookingModeTimer } from './cooking-mode-timer';
import { CookingModeVoiceStatus } from './cooking-mode-voice-status';

type CookingModeStepProps = {
  steps: RecipeStep[];
  stepIndex: number;
  currentStep: RecipeStep;
  currentStepImageUrl?: string | null;
  mentionIngredients: MentionableIngredient[];
  stepIngredients: MentionableIngredient[];
  durationSeconds: number | null;
  remainingSeconds: number;
  timerRunning: boolean;
  voice: CookingModeVoice;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    paddingHorizontal: theme.space.xxl,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.space.lg,
  },
  progress: {
    height: rs(21),
    flexDirection: 'row',
    gap: theme.space.md,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: theme.radius.sm,
  },
  instruction: {
    paddingTop: theme.space.lg,
  },
  ingredients: {
    paddingTop: theme.space.lg,
    gap: theme.space.xs,
  },
  ingredientLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  ingredientLabel: {
    paddingVertical: theme.space.xs,
  },
  artwork: {
    height: rs(140),
    marginTop: theme.space.lg,
    borderRadius: theme.radius.famLarge,
    overflow: 'hidden',
  },
  footer: {
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xs,
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  previous: {
    width: theme.controlSizes.touchTarget,
    height: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextContainer: {
    flex: 1,
  },
  next: {
    flex: 1,
    minHeight: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
}));

function formatIngredientLabel(ingredient: MentionableIngredient): string {
  const hasQuantity = Number.isFinite(ingredient.quantity) && ingredient.quantity > 0;
  return hasQuantity
    ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
    : ingredient.name;
}

export function CookingModeStep({
  steps,
  stepIndex,
  currentStep,
  currentStepImageUrl,
  mentionIngredients,
  stepIngredients,
  durationSeconds,
  remainingSeconds,
  timerRunning,
  voice,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onPreviousStep,
  onNextStep,
}: CookingModeStepProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!currentStep.id) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentStep.id]);
  const stepImages =
    currentStep.images && currentStep.images.length > 0
      ? currentStep.images.map((image, imageIndex) => ({
          key: image.id,
          path: image.storage_path,
          accessibilityLabel:
            imageIndex === 0
              ? `Bild für Schritt ${stepIndex + 1}`
              : `Bild ${imageIndex + 1} für Schritt ${stepIndex + 1}`,
        }))
      : currentStep.image_path
        ? [
            {
              key: currentStep.image_path,
              path: currentStep.image_path,
              accessibilityLabel: `Bild für Schritt ${stepIndex + 1}`,
            },
          ]
        : [];
  const hasInlineImages = splitStepImageMarkers(currentStep.text, stepImages.length).some(
    (segment) => segment.kind === 'image',
  );
  const hasArtwork = Boolean(currentStepImageUrl || stepImages.length > 0);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.progress}>
          {steps.map((step, index) => (
            <View
              key={step.id}
              style={[
                styles.progressSegment,
                { backgroundColor: index <= stepIndex ? colors.accent : colors.backgroundSoft },
              ]}
            />
          ))}
        </View>

        <Txt variant="eyebrow" tone="secondary" weight="500">
          SCHRITT {stepIndex + 1} VON {steps.length}
        </Txt>
        <StepRichContent
          text={currentStep.text}
          ingredients={mentionIngredients}
          images={hasInlineImages ? stepImages : []}
          variant="heading"
          textStyle={styles.instruction}
          weight="600"
        />

        {stepIngredients.length > 0 ? (
          <View style={styles.ingredients}>
            <Txt variant="eyebrow" tone="secondary" weight="500">
              FÜR DIESEN SCHRITT
            </Txt>
            <View style={styles.ingredientLabels}>
              {stepIngredients.map((ingredient) => (
                <Txt
                  key={ingredient.itemId}
                  variant="caption"
                  tone="secondary"
                  weight="500"
                  style={styles.ingredientLabel}>
                  {formatIngredientLabel(ingredient)}
                </Txt>
              ))}
            </View>
          </View>
        ) : null}

        {!hasInlineImages && hasArtwork ? (
          <View style={styles.artwork}>
            <CookingModeArtwork step={currentStep} imageUrl={currentStepImageUrl} />
          </View>
        ) : null}

        <CookingModeVoiceStatus
          status={voice.status}
          transcript={voice.transcript}
          error={voice.error}
          onReadStep={voice.readStep}
          onReadIngredients={voice.readIngredients}
          onStopReading={voice.stopReading}
          onStartListening={voice.startListening}
          onStopListening={voice.stopListening}
        />

        <CookingModeTimer
          durationSeconds={durationSeconds}
          remainingSeconds={remainingSeconds}
          running={timerRunning}
          onStart={onStartTimer}
          onPause={onPauseTimer}
          onReset={onResetTimer}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Press
          onPress={onPreviousStep}
          disabled={stepIndex === 0}
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Schritt"
          style={[
            styles.previous,
            { backgroundColor: colors.backgroundSoft },
            stepIndex === 0 ? { opacity: 0.35 } : undefined,
          ]}>
          <Txt variant="heading" tone="secondary" weight="500">
            ‹
          </Txt>
        </Press>
        <Press
          onPress={onNextStep}
          accessibilityRole="button"
          containerStyle={styles.nextContainer}
          style={[styles.next, { backgroundColor: colors.accent }]}>
          <Txt variant="caption" tone="onAccent" weight="700" center>
            {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
          </Txt>
        </Press>
      </View>
    </View>
  );
}
