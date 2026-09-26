import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import {
  FASTING_PROTOCOL_DURATIONS,
  type FastingProtocol,
  useActiveFastingSession,
  useEndFastMutation,
  useStartFastMutation,
} from '@/features/calorie-tracking/fasting-api';

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

const styles = StyleSheet.create((theme) => ({
  card: {
    padding: theme.space.xxl,
    gap: theme.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  stack: {
    gap: theme.space.lg,
  },
  protocolRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  protocolButton: {
    flex: 1,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
  },
  protocolButtonSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  protocolButtonIdle: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  },
  protocolDescription: {
    padding: theme.space.lg,
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
  },
  startButton: {
    paddingVertical: theme.space.lg,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  statusBox: {
    padding: theme.space.lg,
    borderRadius: theme.radius.sm,
    gap: theme.space.sm,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.space.sm,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.space.xs,
  },
  endButton: {
    paddingVertical: theme.space.lg,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
  },
}));

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
  const [selectedProtocol, setSelectedProtocol] =
    useState<Exclude<FastingProtocol, 'custom' | '5:2'>>('16:8');
  const [now, setNow] = useState(() => Date.now());

  const { data: activeSession } = useActiveFastingSession(userId, childProfileId);
  const startFastMutation = useStartFastMutation();
  const endFastMutation = useEndFastMutation();

  // Tick every 30 seconds while fast is active
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

  // Active Fast Calculations
  const startedTime = activeSession ? new Date(activeSession.started_at).getTime() : 0;
  const elapsedMinutes = activeSession ? Math.max(0, Math.floor((now - startedTime) / 60000)) : 0;
  const targetMinutes = activeSession?.target_duration_minutes || 960;
  const progressRatio = targetMinutes > 0 ? Math.min(1, elapsedMinutes / targetMinutes) : 0;
  const remainingMinutes = Math.max(0, targetMinutes - elapsedMinutes);
  const isTargetReached = elapsedMinutes >= targetMinutes;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Txt variant="body" weight="700">
            ⏱️ Intervallfasten {activeSession ? `(${activeSession.protocol})` : ''}
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          Privat
        </Txt>
      </View>

      {!activeSession ? (
        // Inaktiver Zustand: Protokollauswahl
        <View style={styles.stack}>
          <Txt variant="caption" tone="secondary">
            Wähle dein Fastenprotokoll und starte dein Fastenfenster:
          </Txt>

          {/* Protokoll-Chips */}
          <View style={styles.protocolRow}>
            {PROTOCOLS.map((p) => {
              const isSelected = selectedProtocol === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setSelectedProtocol(p.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.protocolButton,
                    isSelected ? styles.protocolButtonSelected : styles.protocolButtonIdle,
                  ]}>
                  <Txt variant="label" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                    {p.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.protocolDescription}>
            <Txt variant="body">{PROTOCOLS.find((p) => p.key === selectedProtocol)?.desc}</Txt>
          </View>

          <Pressable
            onPress={handleStartFast}
            disabled={startFastMutation.isPending}
            style={styles.startButton}>
            <Txt variant="label" tone="onAccent" weight="700">
              {startFastMutation.isPending ? 'Wird gestartet...' : 'Fasten starten'}
            </Txt>
          </Pressable>
        </View>
      ) : (
        // Aktiver Zustand: Laufender Timer
        <View style={styles.stack}>
          {/* Status-Übersicht */}
          <View style={styles.statusBox}>
            <View style={styles.statusHeader}>
              <Txt variant="caption" tone="secondary">
                Gefastet seit{' '}
                {new Date(activeSession.started_at).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                Uhr
              </Txt>
              <Txt variant="label" weight="700" tone={isTargetReached ? 'success' : 'primary'}>
                {isTargetReached ? 'Essensfenster erreicht!' : 'Fastenphase'}
              </Txt>
            </View>

            <View style={styles.elapsedRow}>
              <Txt variant="display">{formatDuration(elapsedMinutes)}</Txt>
              <Txt variant="body" tone="secondary">
                / Ziel: {formatDuration(targetMinutes)}
              </Txt>
            </View>

            <ProgressBar value={progressRatio} />

            <View style={styles.progressMetaRow}>
              <Txt variant="caption" tone="secondary">
                {isTargetReached
                  ? `+${formatDuration(elapsedMinutes - targetMinutes)} über Zielzeit`
                  : `Noch ${formatDuration(remainingMinutes)} bis zum Essensfenster`}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {Math.round(progressRatio * 100)}%
              </Txt>
            </View>
          </View>

          <Pressable
            onPress={handleEndFast}
            disabled={endFastMutation.isPending}
            style={styles.endButton}>
            <Txt variant="label" tone="danger" weight="700">
              {endFastMutation.isPending ? 'Wird beendet...' : 'Fasten beenden'}
            </Txt>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
