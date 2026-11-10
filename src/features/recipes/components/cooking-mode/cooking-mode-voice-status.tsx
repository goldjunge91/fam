import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { CookingModeVoiceStatus as CookingModeVoiceState } from '../../hooks/use-cooking-mode-voice';

const STATUS_COPY: Record<CookingModeVoiceState, string> = {
  ready: 'Voice bereit',
  reading: 'Vorlesen läuft',
  listening: 'Zuhören läuft',
  processing: 'Befehl wird verarbeitet',
  denied: 'Mikrofonzugriff verweigert',
  unavailable: 'Voice nicht verfügbar',
  error: 'Voice-Fehler',
};

export function getCookingModeVoiceStatusCopy(status: CookingModeVoiceState): string {
  return STATUS_COPY[status];
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
}: CookingModeVoiceStatusProps) {
  const { colors } = useTheme();
  const isListening = status === 'listening' || status === 'processing';
  const hasError = status === 'denied' || status === 'unavailable' || status === 'error';

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundSoft }]}>
      <View style={styles.heading} accessible accessibilityRole="text">
        <View style={[styles.dot, { backgroundColor: statusColor(status, colors) }]} />
        <Txt variant="caption" weight="700">
          {STATUS_COPY[status]}
        </Txt>
      </View>

      {transcript ? (
        <Txt variant="caption" tone="secondary" style={styles.transcript}>
          Gehört: {transcript}
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
          accessibilityLabel={status === 'reading' ? 'Vorlesen stoppen' : 'Vorlesen'}
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
          <Txt variant="caption" weight="700">
            {status === 'reading' ? 'Vorlesen stoppen' : 'Vorlesen'}
          </Txt>
        </Press>
        <Press
          onPress={onReadIngredients}
          accessibilityRole="button"
          accessibilityLabel="Zutaten dieses Schritts vorlesen"
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}>
          <Txt variant="caption" weight="700">
            Zutaten vorlesen
          </Txt>
        </Press>
        <Press
          onPress={isListening ? onStopListening : onStartListening}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Zuhören beenden' : 'Zuhören'}
          style={[styles.action, { backgroundColor: colors.accent }]}>
          <Txt variant="caption" tone="onAccent" weight="700">
            {isListening ? 'Zuhören beenden' : 'Zuhören'}
          </Txt>
        </Press>
      </View>
    </View>
  );
}
