import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import type { RecipeStep } from '../../data/use-recipes';

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
  if (!durationSeconds) return null;

  return (
    <View className="min-h-[58px] mt-[14px] rounded-sheet px-[13px] py-three flex-row items-center gap-[5px] bg-background-element/85">
      <View className="flex-1 min-w-0">
        <ThemedText type="headingSmall">{formatTimer(remainingSeconds)}</ThemedText>
        <ThemedText
          type="detail"
          themeColor="textSecondary"
          className="pt-half text-[8px] leading-[10px] font-medium">
          {remainingSeconds === 0 ? 'Abgelaufen' : running ? 'Läuft' : 'Pausiert'}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => (running ? onPause() : onStart())}
        disabled={remainingSeconds === 0}
        role="button"
        aria-label={running ? 'Timer pausieren' : 'Timer fortsetzen'}
        className="w-[34px] h-[34px] rounded-control items-center justify-center bg-background-selected">
        <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
          {running ? 'Ⅱ' : '▶'}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={onReset}
        role="button"
        aria-label="Timer zurücksetzen"
        className="w-[34px] h-[34px] rounded-control items-center justify-center bg-background-selected">
        <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
          ↺
        </ThemedText>
      </Pressable>
    </View>
  );
}
