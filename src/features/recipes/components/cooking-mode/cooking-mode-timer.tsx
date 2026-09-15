import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { RecipeStep } from '../../hooks/use-recipe-steps';

const styles = StyleSheet.create((theme) => ({
  root: {
    minHeight: rs(58),
    marginTop: rs(14),
    borderRadius: theme.radius.lg,
    paddingHorizontal: rs(13),
    paddingVertical: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    paddingTop: rs(2),
  },
  action: {
    width: rs(34),
    height: rs(34),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export function getCookingTimerDurationSeconds(step: RecipeStep | undefined): number | null {
  if (!step) return null;
  if (step.timer_minutes !== null) return step.timer_minutes * 60;

  const match = step.text.match(/\b(\d{1,3})\s*(?:min(?:ute)?n?)\b/i);
  if (!match) return null;

  const minutes = Number(match[1]);
  return minutes > 0 ? minutes * 60 : null;
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

type CookingModeTimerProps = {
  durationSeconds: number | null;
  remainingSeconds: number;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
};

export function CookingModeTimer({
  durationSeconds,
  remainingSeconds,
  running,
  onStart,
  onPause,
  onReset,
}: CookingModeTimerProps) {
  const { colors } = useTheme();
  if (!durationSeconds) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundElement }]}>
      <View style={styles.copy}>
        <Txt variant="heading">{formatTimer(remainingSeconds)}</Txt>
        <Txt variant="caption" tone="secondary" style={styles.status}>
          {remainingSeconds === 0 ? 'Abgelaufen' : running ? 'Läuft' : 'Pausiert'}
        </Txt>
      </View>
      <Press
        onPress={() => (running ? onPause() : onStart())}
        disabled={remainingSeconds === 0}
        role="button"
        aria-label={running ? 'Timer pausieren' : 'Timer fortsetzen'}
        style={[styles.action, { backgroundColor: colors.backgroundSoft }]}>
        <Txt variant="caption" tone="primary" weight="700">
          {running ? 'Ⅱ' : '▶'}
        </Txt>
      </Press>
      <Press
        onPress={onReset}
        role="button"
        aria-label="Timer zurücksetzen"
        style={[styles.action, { backgroundColor: colors.backgroundSoft }]}>
        <Txt variant="caption" tone="primary" weight="700">
          ↺
        </Txt>
      </Press>
    </View>
  );
}
