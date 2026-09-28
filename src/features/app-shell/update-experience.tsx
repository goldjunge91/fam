import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { ProgressRing } from '@/components/ui/progress-ring';
import { motion } from '@/constants/motion';
import { Button, Txt } from '@/constants/ui';

/** Shows opted-in OTA progress or a development-only preview triggered by app config. */
export function UpdateExperience() {
  const {
    availableUpdate,
    downloadedUpdate,
    downloadError,
    downloadProgress,
    isDownloading,
    isRestarting,
    isUpdateAvailable,
    isUpdatePending,
  } = Updates.useUpdates();
  const reducedMotion = useReducedMotion();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [restartFailed, setRestartFailed] = useState(false);
  const orbit = useSharedValue(0);
  const isDummyExperience = __DEV__ && Constants.expoConfig?.extra?.dummyUpdateExperience === true;

  const isReady = !isDummyExperience && isUpdatePending;
  const phase = isReady ? 'ready' : 'downloading';
  const updateId = downloadedUpdate?.updateId ?? availableUpdate?.updateId ?? 'active-update';
  const updateKey = `${updateId}:${phase}`;
  const updateManifest = downloadedUpdate?.manifest ?? availableUpdate?.manifest;
  const updateExtra =
    updateManifest && 'extra' in updateManifest
      ? updateManifest.extra?.expoClient?.extra
      : undefined;
  const shouldShowExperience = updateExtra?.showUpdateExperience === true;
  const hasActiveUpdate = isUpdateAvailable || isDownloading || isUpdatePending;
  const isVisible =
    (isDummyExperience || (Updates.isEnabled && shouldShowExperience && hasActiveUpdate)) &&
    dismissedKey !== updateKey;
  const shouldAnimate =
    isVisible &&
    (isDummyExperience || isDownloading || isUpdateAvailable) &&
    !downloadError &&
    !reducedMotion;
  const progressPercent = isDummyExperience
    ? 62
    : typeof downloadProgress === 'number' && Number.isFinite(downloadProgress)
      ? Math.min(100, Math.max(0, Math.round(downloadProgress * 100)))
      : null;
  const shownProgress = isDummyExperience
    ? progressPercent
    : isUpdatePending
      ? 100
      : progressPercent;

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(orbit);
      orbit.value = 0;
      return;
    }

    orbit.value = withRepeat(
      withTiming(1, { duration: motion.progressIndeterminate, easing: motion.easing.linear }),
      -1,
    );

    return () => cancelAnimation(orbit);
  }, [orbit, shouldAnimate]);

  useEffect(() => {
    if (phase !== 'ready') setRestartFailed(false);
  }, [phase]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  if (!isVisible) return null;

  const hasError = Boolean(downloadError) || restartFailed;
  const heading = hasError
    ? 'Das Update wartet noch.'
    : isReady
      ? 'Fam ist bereit.'
      : 'Fam wird gerade aktualisiert.';
  const message = hasError
    ? 'Der Download oder Neustart konnte nicht abgeschlossen werden. Du kannst Fam weiter nutzen und es später erneut versuchen.'
    : isReady
      ? 'Starte Fam neu, um die Verbesserungen zu übernehmen. Deine Listen bleiben erhalten.'
      : 'Das Update wird im Hintergrund geladen. Du kannst die Ansicht schließen und in Fam weiterarbeiten.';
  const progressLabel = hasError
    ? 'Update angehalten'
    : isReady
      ? 'Bereit zum Neustart'
      : shownProgress === null
        ? 'Verbesserungen werden geladen'
        : `Verbesserungen werden geladen · ${shownProgress} %`;

  async function handleRestart() {
    setRestartFailed(false);
    try {
      await Updates.reloadAsync();
    } catch {
      setRestartFailed(true);
    }
  }

  function dismiss() {
    setDismissedKey(updateKey);
  }

  return (
    <Animated.View
      accessibilityViewIsModal
      entering={reducedMotion ? undefined : FadeIn.duration(motion.feedbackFast)}
      exiting={reducedMotion ? undefined : FadeOut.duration(motion.feedbackExit)}
      style={styles.overlay}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <Animated.View style={styles.content}>
          <Txt center variant="brand" style={styles.brand}>
            fam
          </Txt>

          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(motion.navigation)}
            style={styles.main}>
            <View style={styles.artwork}>
              <View style={styles.halo} />
              <Animated.View style={[styles.orbit, orbitStyle]}>
                <View style={styles.orbitDot} />
              </Animated.View>
              <ProgressRing
                animated={shownProgress !== null && !reducedMotion}
                displayMode="none"
                label="OTA-Update"
                size={192}
                strokeWidth={9}
                target={shownProgress === null ? 0 : 100}
                unit="%"
                value={shownProgress ?? 0}>
                <Txt center tone="accent" variant="title" weight="600">
                  {shownProgress === null ? '···' : `${shownProgress}%`}
                </Txt>
              </ProgressRing>
            </View>

            <Txt center tone="accent" variant="eyebrow">
              {hasError ? 'UPDATE ANGEHALTEN' : isReady ? 'UPDATE BEREIT' : 'EIN MOMENT NOCH'}
            </Txt>
            <Txt center variant="title" style={styles.heading}>
              {heading}
            </Txt>
            <Txt center muted variant="body" style={styles.message}>
              {message}
            </Txt>

            <View accessibilityLiveRegion="polite" style={styles.progressStatus}>
              <View
                style={[styles.statusDot, hasError && styles.errorDot, isReady && styles.readyDot]}
              />
              <Txt center muted variant="caption">
                {progressLabel}
              </Txt>
            </View>
          </Animated.View>

          <View style={styles.actions}>
            <Button
              accessibilityLabel={
                isReady
                  ? 'Fam jetzt mit dem Update neu starten'
                  : 'Update weiterladen und Fam öffnen'
              }
              full
              loading={isReady && isRestarting}
              onPress={isReady ? handleRestart : dismiss}
              size="lg"
              title={
                isReady
                  ? restartFailed
                    ? 'Erneut versuchen'
                    : 'Jetzt neu starten'
                  : 'Weiter in Fam'
              }
              variant={isReady ? 'primary' : 'secondary'}
            />
            {isReady ? (
              <Button full onPress={dismiss} size="md" title="Später" variant="link" />
            ) : null}
          </View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: theme.background,
  },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.space.xl,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.md,
  },
  brand: { paddingVertical: theme.space.sm },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artwork: {
    width: 232,
    height: 232,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.xl,
  },
  halo: {
    position: 'absolute',
    width: 212,
    height: 212,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.backgroundSoft,
    opacity: 0.32,
  },
  orbit: {
    position: 'absolute',
    width: 222,
    height: 222,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: theme.border,
    borderRadius: theme.radius.pill,
  },
  orbitDot: {
    position: 'absolute',
    top: 22,
    right: 30,
    width: 9,
    height: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.premiumGradientEnd,
  },
  heading: { maxWidth: 340, marginTop: theme.space.sm },
  message: { maxWidth: 340, marginTop: theme.space.sm },
  progressStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.xl,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  errorDot: { backgroundColor: theme.danger },
  readyDot: { backgroundColor: theme.success },
  actions: { width: '100%', maxWidth: 420, paddingTop: theme.space.lg },
}));
