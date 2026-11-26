import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { Button, Surface, Txt } from '@/constants/ui';
import { CodeSample, ContractIntro, ExamplePair, Subsection } from './showcase-shared';

export type ReanimatedCategory = 'reanimated';
type MotionMode = 'spring' | 'timing' | 'sequence';

const MOTION_MODES = [
  { value: 'spring', labelKey: 'dev.design.reanimated.spring' },
  { value: 'timing', labelKey: 'dev.design.reanimated.timing' },
  { value: 'sequence', labelKey: 'dev.design.reanimated.sequence' },
] as const;

const FUNCTION_REFERENCE = [
  ['useSharedValue', 'dev.design.reanimated.useSharedValue'],
  ['useAnimatedStyle', 'dev.design.reanimated.useAnimatedStyle'],
  ['useDerivedValue', 'dev.design.reanimated.useDerivedValue'],
  ['withSpring / withTiming', 'dev.design.reanimated.springTiming'],
  ['Gesture.Pan', 'dev.design.reanimated.gesturePan'],
  ['scheduleOnRN', 'dev.design.reanimated.scheduleOnRn'],
] as const;

const styles = StyleSheet.create((theme) => ({
  page: {
    gap: theme.space.xxl,
  },
  panel: {
    gap: theme.space.lg,
  },
  motionStage: {
    minHeight: 136,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  motionTile: {
    minWidth: 168,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.accent,
  },
  gestureStage: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  gestureTile: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.accent,
  },
  composedTile: {
    minHeight: 80,
    justifyContent: 'center',
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  incorrectTile: {
    minHeight: 80,
    justifyContent: 'center',
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.danger,
  },
  capability: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
  },
  capabilityMarker: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  capabilityCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  derivedTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.border,
  },
  derivedFill: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
}));

function MotionBasicsDemo() {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const [runs, setRuns] = useState(0);
  const [mode, setMode] = useState<MotionMode>('spring');
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const startAnimation = () => {
    setRuns((currentRuns) => currentRuns + 1);

    if (reducedMotion) {
      scale.value = 1;
      return;
    }

    if (mode === 'spring') {
      scale.value = withSequence(
        withSpring(1.18, { damping: 7, stiffness: 240, mass: 0.7 }),
        withSpring(1, { damping: 13, stiffness: 260, mass: 0.5 }),
      );
      return;
    }

    if (mode === 'timing') {
      scale.value = withSequence(
        withTiming(0.78, { duration: 180 }),
        withTiming(1.16, { duration: 520 }),
        withTiming(1, { duration: 180 }),
      );
      return;
    }

    scale.value = withSequence(
      withTiming(0.8, { duration: 90 }),
      withTiming(1.2, { duration: 90 }),
      withTiming(0.9, { duration: 90 }),
      withTiming(1, { duration: 90 }),
    );
  };

  return (
    <Subsection title={t('dev.design.reanimated.motionBasics')}>
      <Txt variant="body" tone="secondary">
        {t('dev.design.reanimated.motionHint')}
      </Txt>
      <Surface style={styles.panel}>
        <FilterChipBar
          label={t('dev.design.reanimated.motionMode')}
          options={MOTION_MODES.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
          selected={mode}
          onSelect={setMode}
        />
        <View style={styles.motionStage}>
          <Animated.View style={[styles.motionTile, animatedStyle]}>
            <Txt variant="heading" tone="onAccent">
              fam
            </Txt>
            <Txt variant="caption" tone="onAccent">
              {t('dev.design.reanimated.transientFeedback')}
            </Txt>
          </Animated.View>
        </View>
        <Button title={t('dev.design.reanimated.animate')} onPress={startAnimation} />
        <Txt variant="caption" tone="secondary">
          {t('dev.design.reanimated.runs', { count: runs })}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {reducedMotion
            ? t('dev.design.reanimated.reducedMotion')
            : t('dev.design.reanimated.activeMode', {
                mode: t(
                  MOTION_MODES.find((option) => option.value === mode)?.labelKey ??
                    'dev.design.reanimated.spring',
                ),
              })}
        </Txt>
      </Surface>
      <CodeSample>
        {`Spring:   withSequence(withSpring(1.18), withSpring(1))
Timing:   withTiming(0.78, { duration: 180 }) → 1.16 → 1
Sequence: 0.8 → 1.2 → 0.9 → 1`}
      </CodeSample>
    </Subsection>
  );
}

function GestureDemo() {
  const { t } = useTranslation();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [status, setStatus] = useState(t('dev.design.reanimated.noDrop'));

  const reportDrop = useCallback(() => {
    setStatus(t('dev.design.reanimated.dropProcessed'));
  }, [t]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      'worklet';
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scheduleOnRN(reportDrop);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <Subsection title={t('dev.design.reanimated.gestureTitle')}>
      <Txt variant="body" tone="secondary">
        {t('dev.design.reanimated.gestureHint')}
      </Txt>
      <Surface style={styles.panel}>
        <View style={styles.gestureStage}>
          <GestureDetector gesture={gesture}>
            <Animated.View
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('dev.design.reanimated.dragDemo')}
              style={[styles.gestureTile, animatedStyle]}>
              <Txt variant="label" tone="onAccent">
                {t('dev.design.reanimated.drag')}
              </Txt>
            </Animated.View>
          </GestureDetector>
        </View>
        <Txt variant="caption" tone="secondary">
          {status}
        </Txt>
      </Surface>
      <CodeSample>
        {`const gesture = Gesture.Pan()
  .onEnd(() => {
    'worklet'
    scheduleOnRN(onDrop)
  })`}
      </CodeSample>
    </Subsection>
  );
}

function DerivedValuesDemo() {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const derivedScale = useDerivedValue(() => interpolate(progress.value, [0, 1], [0.82, 1]));
  const [step, setStep] = useState(0);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: derivedScale.value }],
  }));

  const advanceProgress = () => {
    const nextStep = (step + 1) % 4;
    setStep(nextStep);
    progress.value = withTiming(nextStep / 3, { duration: 240 });
  };

  return (
    <Subsection title={t('dev.design.reanimated.derivedTitle')}>
      <Txt variant="body" tone="secondary">
        {t('dev.design.reanimated.derivedHint')}
      </Txt>
      <Surface style={styles.panel}>
        <View style={styles.motionStage}>
          <View style={styles.derivedTrack}>
            <Animated.View style={[styles.derivedFill, fillStyle]} />
          </View>
          <Animated.View style={[styles.composedTile, tileStyle]}>
            <Txt variant="label">
              {t('dev.design.reanimated.syncedPercent', { percent: [0, 33, 66, 100][step] })}
            </Txt>
          </Animated.View>
        </View>
        <Button title={t('dev.design.reanimated.continueProgress')} onPress={advanceProgress} />
      </Surface>
      <CodeSample>
        {`const progress = useSharedValue(0)
const scale = useDerivedValue(() =>
  interpolate(progress.value, [0, 1], [0.82, 1]),
)`}
      </CodeSample>
    </Subsection>
  );
}

function UnistylesCompositionDemo() {
  const { t } = useTranslation();
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animateComposition = () => {
    translateY.value = withSequence(
      withTiming(-8, { duration: 130 }),
      withSpring(0, { damping: 14, stiffness: 280 }),
    );
  };

  return (
    <Subsection title={t('dev.design.reanimated.compositionTitle')}>
      <Txt variant="body" tone="secondary">
        {t('dev.design.reanimated.compositionHint')}
      </Txt>
      <ExamplePair
        correct={
          <View style={styles.panel}>
            <Animated.View style={[styles.composedTile, animatedStyle]}>
              <Txt variant="label">{t('dev.design.reanimated.staticDynamic')}</Txt>
              <Txt variant="caption" tone="secondary">
                {t('dev.design.reanimated.themeInUnistyles')}
              </Txt>
            </Animated.View>
            <Button
              title={t('dev.design.reanimated.animateComposition')}
              onPress={animateComposition}
            />
          </View>
        }
        incorrect={
          <View style={styles.incorrectTile}>
            <Txt variant="label" tone="danger">
              {t('dev.design.reanimated.noSpread')}
            </Txt>
            <Txt variant="caption" tone="secondary">
              {t('dev.design.reanimated.spreadHint')}
            </Txt>
          </View>
        }
        correctCode="<Animated.View style={[styles.card, animatedStyle]} />"
        incorrectCode="<Animated.View style={{ ...styles.card, ...animatedStyle }} />"
      />
    </Subsection>
  );
}

function FunctionReference() {
  const { t } = useTranslation();
  return (
    <Subsection title={t('dev.design.reanimated.reference')}>
      <View style={styles.panel}>
        {FUNCTION_REFERENCE.map(([title, detailKey]) => (
          <CapabilityRow key={title} title={title} detail={t(detailKey)} />
        ))}
      </View>
    </Subsection>
  );
}

function CapabilityRow({ detail, title }: { detail: string; title: string }) {
  return (
    <View style={styles.capability}>
      <View style={styles.capabilityMarker} />
      <View style={styles.capabilityCopy}>
        <Txt variant="label">{title}</Txt>
        <Txt variant="caption" tone="secondary">
          {detail}
        </Txt>
      </View>
    </View>
  );
}

export function ReanimatedShowcase() {
  const { t } = useTranslation();
  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.reanimated.title')}
        contract={t('dev.design.reanimated.contract')}
        source={t('dev.design.reanimated.source')}
      />
      <MotionBasicsDemo />
      <GestureDemo />
      <DerivedValuesDemo />
      <UnistylesCompositionDemo />
      <FunctionReference />
      <Subsection title={t('dev.design.reanimated.useCases')}>
        <Txt variant="body" tone="secondary">
          {t('dev.design.reanimated.useCasesHint')}
        </Txt>
        <View style={styles.panel}>
          <CapabilityRow
            title={t('dev.design.reanimated.pressFeedback')}
            detail={t('dev.design.reanimated.pressFeedbackHint')}
          />
          <CapabilityRow
            title={t('dev.design.reanimated.dragDrop')}
            detail={t('dev.design.reanimated.dragDropHint')}
          />
          <CapabilityRow
            title={t('dev.design.reanimated.swipeActions')}
            detail={t('dev.design.reanimated.swipeActionsHint')}
          />
          <CapabilityRow
            title={t('dev.design.reanimated.focusedTransitions')}
            detail={t('dev.design.reanimated.focusedTransitionsHint')}
          />
        </View>
      </Subsection>
    </View>
  );
}
