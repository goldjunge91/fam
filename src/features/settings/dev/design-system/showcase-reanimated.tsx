import { useCallback, useState } from 'react';
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

import { FilterChipBar, type FilterChipOption } from '@/components/ui/filter-chip-bar';
import { Button, Surface, Txt } from '@/constants/ui';
import { CodeSample, ContractIntro, ExamplePair, Subsection } from './showcase-shared';

export type ReanimatedCategory = 'reanimated';
type MotionMode = 'spring' | 'timing' | 'sequence';

const MOTION_MODES = [
  { value: 'spring', label: 'Spring' },
  { value: 'timing', label: 'Timing' },
  { value: 'sequence', label: 'Sequence' },
] as const satisfies readonly FilterChipOption<MotionMode>[];

const FUNCTION_REFERENCE = [
  ['useSharedValue', 'UI-Thread-Werte ohne React-Render.'],
  ['useAnimatedStyle', 'Verbindet Shared Values mit dynamischen View-Styles.'],
  ['useDerivedValue', 'Leitet UI-Thread-Werte ohne JS-State ab.'],
  ['withSpring / withTiming', 'Physikalische oder zeitgesteuerte Übergänge.'],
  ['Gesture.Pan', 'Direkte Werte für Drag-, Swipe- und Reorder-Interaktionen.'],
  ['scheduleOnRN', 'Plant fachliche Ergebnisse zurück auf den RN-Thread.'],
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
  const scale = useSharedValue(1);
  const [runs, setRuns] = useState(0);
  const [mode, setMode] = useState<MotionMode>('spring');
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const startAnimation = () => {
    setRuns((currentRuns) => currentRuns + 1);

    if (mode === 'spring') {
      scale.value = withSpring(1, { damping: 14, stiffness: 320, mass: 0.5 });
      return;
    }

    if (mode === 'timing') {
      scale.value = withSequence(
        withTiming(0.9, { duration: reducedMotion ? 0 : 120 }),
        withTiming(1, { duration: reducedMotion ? 0 : 220 }),
      );
      return;
    }

    scale.value = withSequence(
      withTiming(0.88, { duration: reducedMotion ? 0 : 90 }),
      withSpring(1, { damping: 14, stiffness: 320, mass: 0.5 }),
    );
  };

  return (
    <Subsection title="Motion Basics">
      <Txt variant="body" tone="secondary">
        One-shot-Feedback bleibt auf dem UI-Thread und reagiert direkt auf eine Nutzeraktion.
      </Txt>
      <Surface style={styles.panel}>
        <FilterChipBar
          label="Motion-Modus"
          options={MOTION_MODES}
          selected={mode}
          onSelect={setMode}
        />
        <View style={styles.motionStage}>
          <Animated.View style={[styles.motionTile, animatedStyle]}>
            <Txt variant="heading" tone="onAccent">
              fam
            </Txt>
            <Txt variant="caption" tone="onAccent">
              transient feedback
            </Txt>
          </Animated.View>
        </View>
        <Button title="Animation starten" onPress={startAnimation} />
        <Txt variant="caption" tone="secondary">
          Ausgeführt: {runs}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {reducedMotion
            ? 'Reduced Motion ist aktiv: zeitbasierte Übergänge werden verkürzt.'
            : `Aktiver Modus: ${mode}`}
        </Txt>
      </Surface>
      <CodeSample>
        {`const scale = useSharedValue(1)

scale.value = withSequence(
  withTiming(0.9, { duration: 90 }),
  withSpring(1),
)`}
      </CodeSample>
    </Subsection>
  );
}

function GestureDemo() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [status, setStatus] = useState('Noch kein Drop verarbeitet');

  const reportDrop = useCallback(() => {
    setStatus('UI-Thread → RN: Drop verarbeitet');
  }, []);

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
    <Subsection title="Gestures & UI Thread">
      <Txt variant="body" tone="secondary">
        Gestenwerte werden auf dem UI-Thread verarbeitet. Nur das fachliche Ergebnis wechselt zurück
        zu React Native.
      </Txt>
      <Surface style={styles.panel}>
        <View style={styles.gestureStage}>
          <GestureDetector gesture={gesture}>
            <Animated.View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Reanimated Drag-Demo"
              style={[styles.gestureTile, animatedStyle]}>
              <Txt variant="label" tone="onAccent">
                Ziehen
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
    <Subsection title="Derived Values">
      <Txt variant="body" tone="secondary">
        Ein Fortschrittswert steuert mehrere UI-Eigenschaften. Die Ableitung bleibt auf dem
        UI-Thread und erzeugt keinen React-Render pro Frame.
      </Txt>
      <Surface style={styles.panel}>
        <View style={styles.motionStage}>
          <View style={styles.derivedTrack}>
            <Animated.View style={[styles.derivedFill, fillStyle]} />
          </View>
          <Animated.View style={[styles.composedTile, tileStyle]}>
            <Txt variant="label">{[0, 33, 66, 100][step]}% synchronisiert</Txt>
          </Animated.View>
        </View>
        <Button title="Fortschritt weiterführen" onPress={advanceProgress} />
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
    <Subsection title="Unistyles + Reanimated">
      <Txt variant="body" tone="secondary">
        Statische, theme-abhängige Styles und dynamische Animated Styles werden als Array
        kombiniert.
      </Txt>
      <ExamplePair
        correct={
          <View style={styles.panel}>
            <Animated.View style={[styles.composedTile, animatedStyle]}>
              <Txt variant="label">STATISCH + DYNAMISCH</Txt>
              <Txt variant="caption" tone="secondary">
                Das Theme bleibt in Unistyles.
              </Txt>
            </Animated.View>
            <Button title="Kombination animieren" onPress={animateComposition} />
          </View>
        }
        incorrect={
          <View style={styles.incorrectTile}>
            <Txt variant="label" tone="danger">
              Spread nicht verwenden
            </Txt>
            <Txt variant="caption" tone="secondary">
              Animated Styles können dadurch ihre Laufzeitwerte verlieren.
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
  return (
    <Subsection title="Reanimated-Werkzeugkasten">
      <View style={styles.panel}>
        {FUNCTION_REFERENCE.map((item) => (
          <CapabilityRow key={item[0]} title={item[0]} detail={item[1]} />
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
  return (
    <View style={styles.page}>
      <ContractIntro
        title="Reanimated und Worklets"
        contract="Animationen und Gesten bleiben transient. Berechnungen laufen auf dem UI-Thread, während fachliche Zustandsänderungen gezielt zurück nach React Native geplant werden."
        source="react-native-reanimated 4 · react-native-worklets"
      />
      <MotionBasicsDemo />
      <GestureDemo />
      <DerivedValuesDemo />
      <UnistylesCompositionDemo />
      <FunctionReference />
      <Subsection title="Einsatzpunkte in Haushaltsapp">
        <Txt variant="body" tone="secondary">
          Diese Muster passen zu Interaktionen, die bereits in unserem Produkt vorkommen oder
          sinnvoll erweitert werden können.
        </Txt>
        <View style={styles.panel}>
          <CapabilityRow
            title="Press-Feedback"
            detail="Buttons, FAB und Icons geben unmittelbares Feedback über Spring- und Timing-Animationen."
          />
          <CapabilityRow
            title="Drag & Drop"
            detail="Die Wochenplanung verarbeitet Drag-Bewegungen auf dem UI-Thread und meldet nur den Drop an React Native."
          />
          <CapabilityRow
            title="Swipe-Aktionen"
            detail="Inventarzeilen können Aktionen wie Erledigen oder Löschen mit einer kontrollierten Geste offenlegen."
          />
          <CapabilityRow
            title="Fokussierte Übergänge"
            detail="Drawer-, Jiggle- und Celebration-Interaktionen bleiben ereignisgetrieben und werden nicht dauerhaft neu gezeichnet."
          />
        </View>
      </Subsection>
    </View>
  );
}
