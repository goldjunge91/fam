import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { i18n } from '@/i18n';
import type { CookingModeVoiceStatus as CookingModeVoiceState } from '../../hooks/use-cooking-mode-voice';

type CookingModeVoiceStatusKey =
  | 'recipes.cooking.voiceReady'
  | 'recipes.cooking.voiceReading'
  | 'recipes.cooking.voiceListening'
  | 'recipes.cooking.voiceProcessing'
  | 'recipes.cooking.voicePaused'
  | 'recipes.cooking.voiceDenied'
  | 'recipes.cooking.voiceUnavailable'
  | 'recipes.cooking.voiceError';

const STATUS_KEYS = {
  ready: 'recipes.cooking.voiceReady',
  reading: 'recipes.cooking.voiceReading',
  listening: 'recipes.cooking.voiceListening',
  processing: 'recipes.cooking.voiceProcessing',
  paused: 'recipes.cooking.voicePaused',
  denied: 'recipes.cooking.voiceDenied',
  unavailable: 'recipes.cooking.voiceUnavailable',
  error: 'recipes.cooking.voiceError',
} as const satisfies Record<CookingModeVoiceState, CookingModeVoiceStatusKey>;

export function getCookingModeVoiceStatusCopy(
  status: CookingModeVoiceState,
  t: TFunction = i18n.t,
): string {
  return t(STATUS_KEYS[status]);
}

const styles = StyleSheet.create((theme) => ({
  root: {
    marginTop: theme.space.lg,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  action: {
    minHeight: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcript: {
    paddingTop: theme.space.xs,
  },
  error: {
    paddingTop: theme.space.xs,
  },
}));

type CookingModeVoiceStatusProps = {
  status: CookingModeVoiceState;
  transcript: string | null;
  error: string | null;
  onReadStep: () => void;
  onReadIngredients: () => void;
  onStopReading: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  handsFreeEnabled: boolean;
  onPauseHandsFree: () => void;
  onResumeHandsFree: () => void;
  onEndHandsFree: () => void;
};

function statusColor(status: CookingModeVoiceState, colors: ReturnType<typeof useTheme>['colors']) {
  if (status === 'denied' || status === 'error') return colors.danger;
  if (status === 'unavailable') return colors.warning;
  if (status === 'reading' || status === 'listening' || status === 'processing')
    return colors.accent;
  return colors.success;
}

export function CookingModeVoiceStatus({
  status,
  transcript,
  error,
  onReadStep,
  onReadIngredients,
  onStopReading,
  onStartListening,
  onStopListening,
  handsFreeEnabled,
  onPauseHandsFree,
  onResumeHandsFree,
  onEndHandsFree,
}: CookingModeVoiceStatusProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isListening = status === 'listening' || status === 'processing';
  const hasError = status === 'denied' || status === 'unavailable' || status === 'error';

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundSoft }]}>
      <View style={styles.heading} accessible accessibilityRole="text">
        <View style={[styles.dot, { backgroundColor: statusColor(status, colors) }]} />
        <Txt variant="caption" weight="700">
          {getCookingModeVoiceStatusCopy(status, t)}
        </Txt>
      </View>

      {transcript ? (
        <Txt variant="caption" tone="secondary" style={styles.transcript}>
          {t('recipes.cooking.heard', { transcript })}
        </Txt>
      ) : null}
      {hasError && error ? (
        <View accessible accessibilityRole="alert">
          <Txt variant="caption" tone="danger" style={styles.error}>
            {error}
          </Txt>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Press
          onPress={status === 'reading' ? onStopReading : onReadStep}
          accessibilityRole="button"
          accessibilityLabel={
            status === 'reading' ? t('recipes.cooking.readStop') : t('recipes.cooking.read')
          }
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
          <Txt variant="caption" weight="700">
            {status === 'reading' ? t('recipes.cooking.readStop') : t('recipes.cooking.read')}
          </Txt>
        </Press>
        <Press
          onPress={onReadIngredients}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.cooking.readIngredients')}
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
          <Txt variant="caption" weight="700">
            {t('recipes.cooking.readIngredients')}
          </Txt>
        </Press>
        <Press
          onPress={isListening ? onStopListening : onStartListening}
          accessibilityRole="button"
          accessibilityLabel={
            isListening ? t('recipes.cooking.listenEnd') : t('recipes.cooking.listen')
          }
          style={[styles.action, { backgroundColor: colors.accent }]}>
          <Txt variant="caption" tone="onAccent" weight="700">
            {isListening ? t('recipes.cooking.listenEnd') : t('recipes.cooking.listen')}
          </Txt>
        </Press>
        {handsFreeEnabled ? (
          <>
            <Press
              onPress={status === 'paused' ? onResumeHandsFree : onPauseHandsFree}
              accessibilityRole="button"
              accessibilityLabel={
                status === 'paused'
                  ? t('recipes.cooking.resumeHandsFree')
                  : t('recipes.cooking.pauseHandsFree')
              }
              style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
              <Txt variant="caption" weight="700">
                {status === 'paused'
                  ? t('recipes.cooking.resumeHandsFree')
                  : t('recipes.cooking.pauseHandsFree')}
              </Txt>
            </Press>
            <Press
              onPress={onEndHandsFree}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.cooking.endHandsFree')}
              style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
              <Txt variant="caption" weight="700">
                {t('recipes.cooking.endHandsFree')}
              </Txt>
            </Press>
          </>
        ) : null}
      </View>
    </View>
  );
}
