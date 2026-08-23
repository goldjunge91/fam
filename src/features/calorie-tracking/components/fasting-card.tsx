import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  FASTING_PROTOCOL_DURATIONS,
  type FastingProtocol,
  useActiveFastingSession,
  useEndFastMutation,
  useStartFastMutation,
} from '@/features/calorie-tracking/fasting-api';
import { useTheme } from '@/hooks/use-theme';

const PROTOCOLS: {
  key: Exclude<FastingProtocol, 'custom' | '5:2'>;
  label: string;
  desc: string;
}[] = [
  { key: '16:8', label: '16:8', desc: '16h Fasten · 8h Essen' },
  { key: '18:6', label: '18:6', desc: '18h Fasten · 6h Essen' },
  { key: '20:4', label: '20:4', desc: '20h Fasten · 4h Essen' },
  { key: 'omad', label: 'OMAD', desc: '23h Fasten (One Meal A Day)' },
];

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type FastingCardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
};

export function FastingCard({ userId, childProfileId }: FastingCardProps) {
  const theme = useTheme();
  const [selectedProtocol, setSelectedProtocol] =
    useState<Exclude<FastingProtocol, 'custom' | '5:2'>>('16:8');
  const [now, setNow] = useState(() => Date.now());

  const { data: activeSession } = useActiveFastingSession(userId, childProfileId);
  const startFastMutation = useStartFastMutation();
  const endFastMutation = useEndFastMutation();

  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [activeSession]);

  function handleStartFast() {
    if (!userId) return;
    const duration = FASTING_PROTOCOL_DURATIONS[selectedProtocol];
    startFastMutation.mutate({
      userId,
      childProfileId,
      protocol: selectedProtocol,
      targetDurationMinutes: duration,
      startedAt: new Date().toISOString(),
    });
  }

  function handleEndFast() {
    if (!userId || !activeSession) return;
    endFastMutation.mutate({
      sessionId: activeSession.id,
      userId,
      childProfileId,
      endedAt: new Date().toISOString(),
    });
  }

  const startedTime = activeSession ? new Date(activeSession.started_at).getTime() : 0;
  const elapsedMinutes = activeSession ? Math.max(0, Math.floor((now - startedTime) / 60000)) : 0;
  const targetMinutes = activeSession?.target_duration_minutes || 960;
  const progressRatio = targetMinutes > 0 ? Math.min(1, elapsedMinutes / targetMinutes) : 0;
  const remainingMinutes = Math.max(0, targetMinutes - elapsedMinutes);
  const isTargetReached = elapsedMinutes >= targetMinutes;

  return (
    <Card className="p-four gap-three">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-two">
          <ThemedText type="smallBold">
            ⏱️ Intervallfasten {activeSession ? `(${activeSession.protocol})` : ''}
          </ThemedText>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Privat
        </ThemedText>
      </View>

      {!activeSession ? (
        <View className="gap-three">
          <ThemedText type="caption" themeColor="textSecondary">
            Wähle dein Fastenprotokoll und starte dein Fastenfenster:
          </ThemedText>

          <View className="flex-row gap-two">
            {PROTOCOLS.map((p) => {
              const isSelected = selectedProtocol === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setSelectedProtocol(p.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                    borderColor: isSelected ? theme.accent : theme.border,
                  }}
                  className="flex-1 py-two rounded-xl items-center justify-center border">
                  <ThemedText type="labelBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View className="bg-surface p-three rounded-xl border border-border flex-row items-center justify-between">
            <ThemedText type="small">
              {PROTOCOLS.find((p) => p.key === selectedProtocol)?.desc}
            </ThemedText>
          </View>

          <Pressable
            onPress={handleStartFast}
            disabled={startFastMutation.isPending}
            style={{ backgroundColor: theme.accent }}
            className="py-three rounded-xl items-center justify-center">
            <ThemedText type="labelBold" themeColor="onAccent">
              {startFastMutation.isPending ? 'Wird gestartet...' : 'Fasten starten'}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View className="gap-three">
          <View className="bg-surface p-three rounded-xl border border-border gap-two">
            <View className="flex-row justify-between items-center">
              <ThemedText type="caption" themeColor="textSecondary">
                Gefastet seit{' '}
                {new Date(activeSession.started_at).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                Uhr
              </ThemedText>
              <ThemedText type="labelBold" themeColor={isTargetReached ? 'success' : 'accent'}>
                {isTargetReached ? 'Essensfenster erreicht!' : 'Fastenphase'}
              </ThemedText>
            </View>

            <View className="flex-row items-baseline gap-two">
              <ThemedText type="title">{formatDuration(elapsedMinutes)}</ThemedText>
              <ThemedText type="bodySmall" themeColor="textSecondary">
                / Ziel: {formatDuration(targetMinutes)}
              </ThemedText>
            </View>

            <ProgressBar value={progressRatio} />

            <View className="flex-row justify-between pt-one">
              <ThemedText type="caption" themeColor="textSecondary">
                {isTargetReached
                  ? `+${formatDuration(elapsedMinutes - targetMinutes)} über Zielzeit`
                  : `Noch ${formatDuration(remainingMinutes)} bis zum Essensfenster`}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {Math.round(progressRatio * 100)}%
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={handleEndFast}
            disabled={endFastMutation.isPending}
            className="py-three bg-card border border-border rounded-xl items-center justify-center">
            <ThemedText type="labelBold" themeColor="danger">
              {endFastMutation.isPending ? 'Wird beendet...' : 'Fasten beenden'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
