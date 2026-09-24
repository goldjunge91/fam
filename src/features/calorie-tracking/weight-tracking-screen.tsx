import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Button, Card, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  useAddWeightEntryMutation,
  useWeightHistory,
  type WeightEntryRow,
} from '@/features/calorie-tracking/api';
import { getLogicalDateForTimestamp } from '@/features/calorie-tracking/domain/day-boundary';
import { useProfile } from '@/features/profile/api';

const CHART_ENTRY_LIMIT = 14;

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.lg,
  },
  summary: {
    gap: theme.space.xs,
  },
  summaryValue: {
    marginTop: theme.space.xs / 2,
  },
  form: {
    gap: theme.space.sm,
  },
  formActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  formAction: {
    flex: 1,
  },
  chartCard: {
    gap: theme.space.md,
  },
  chartHeader: {
    gap: theme.space.xs / 2,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 154,
    gap: theme.space.xs,
  },
  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space.xs,
  },
  chartBar: {
    width: '58%',
    minHeight: 4,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.accent,
  },
  chartDate: {
    fontSize: theme.font.sizes.micro,
    lineHeight: 12,
  },
  chartScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingTop: theme.space.xs,
  },
  history: {
    gap: theme.space.sm,
  },
  historyHeader: {
    gap: theme.space.xs / 2,
  },
  historyRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyCopy: {
    flex: 1,
    gap: theme.space.xs / 2,
  },
  empty: {
    paddingVertical: theme.space.lg,
  },
}));

function parseLogicalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLogicalDate(isoDate: string): string {
  return parseLogicalDate(isoDate).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatWeight(value: number): string {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`;
}

function formatTime(value: string | null): string {
  return value
    ? new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : 'Eintrag';
}

function Chart({ entries }: { entries: WeightEntryRow[] }) {
  const chartEntries = [...entries].slice(0, CHART_ENTRY_LIMIT).reverse();

  if (chartEntries.length === 0) {
    return (
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Txt variant="subheading">Verlauf</Txt>
          <Txt variant="caption" tone="secondary">
            Noch keine Messungen vorhanden
          </Txt>
        </View>
      </Card>
    );
  }

  const values = chartEntries.map((entry) => entry.weight_kg);
  const minWeight = Math.min(...values);
  const maxWeight = Math.max(...values);
  const range = Math.max(maxWeight - minWeight, 1);

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Txt variant="subheading">Verlauf</Txt>
        <Txt variant="caption" tone="secondary">
          Die letzten {chartEntries.length} Messungen
        </Txt>
      </View>
      <View style={styles.chartArea}>
        {chartEntries.map((entry) => {
          const height = 18 + ((entry.weight_kg - minWeight) / range) * 112;
          return (
            <View key={entry.id} style={styles.chartColumn}>
              <View style={[styles.chartBar, { height }]} />
              <Txt variant="caption" tone="secondary" style={styles.chartDate}>
                {entry.measured_on.slice(8, 10)}.
              </Txt>
            </View>
          );
        })}
      </View>
      <View style={styles.chartScale}>
        <Txt variant="caption" tone="secondary">
          {formatWeight(minWeight)}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {formatWeight(maxWeight)}
        </Txt>
      </View>
    </Card>
  );
}

function WeightEntryForm({
  userId,
  logicalDate,
  dayStartTime,
  onCancel,
}: {
  userId: string;
  logicalDate: string;
  dayStartTime: string;
  onCancel: () => void;
}) {
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const mutation = useAddWeightEntryMutation();

  async function save() {
    const weightKg = Number(weightInput.trim().replace(',', '.'));
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg >= 700) {
      setError('Bitte gib ein gültiges Gewicht unter 700 kg ein.');
      return;
    }

    setError(undefined);
    try {
      await mutation.mutateAsync({
        userId,
        weightKg,
        measuredOn: logicalDate,
        dayStartTime,
      });
      onCancel();
    } catch {
      setError('Der Gewichtseintrag konnte nicht gespeichert werden.');
    }
  }

  return (
    <Card style={styles.form}>
      <TextField
        label="Gewicht (kg)"
        value={weightInput}
        onChangeText={(value) => {
          setWeightInput(value);
          setError(undefined);
        }}
        placeholder="75"
        inputMode="decimal"
        keyboardType="decimal-pad"
        size="large"
        error={error}
      />
      <View style={styles.formActions}>
        <Button
          title="Abbrechen"
          variant="secondary"
          onPress={onCancel}
          style={styles.formAction}
        />
        <Button
          title="Speichern"
          onPress={() => void save()}
          loading={mutation.isPending}
          disabled={!weightInput.trim()}
          style={styles.formAction}
        />
      </View>
    </Card>
  );
}

export function WeightTrackingScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: entries = [], isLoading } = useWeightHistory(userId);
  const [formVisible, setFormVisible] = useState(false);
  const dayStartTime = profile?.tracking_day_start_time ?? '00:00';
  const todayLogicalDate = getLogicalDateForTimestamp(new Date(), dayStartTime);
  const latestEntry = entries[0];

  return (
    <Screen
      title="Gewicht"
      back={{ label: 'Tagebuch', href: '/diary' }}
      backStyle="icon"
      action={
        <Button
          title="Neuer Eintrag"
          icon="plus"
          size="sm"
          onPress={() => setFormVisible((visible) => !visible)}
        />
      }>
      <View style={styles.content}>
        <Card style={styles.summary}>
          <Txt variant="caption" tone="secondary">
            Letzte Messung
          </Txt>
          <Txt variant="heading" style={styles.summaryValue}>
            {latestEntry ? formatWeight(latestEntry.weight_kg) : 'Noch kein Eintrag'}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {latestEntry
              ? formatLogicalDate(latestEntry.measured_on)
              : 'Füge deine erste Messung hinzu.'}
          </Txt>
        </Card>

        {formVisible && userId ? (
          <WeightEntryForm
            userId={userId}
            logicalDate={todayLogicalDate}
            dayStartTime={dayStartTime}
            onCancel={() => setFormVisible(false)}
          />
        ) : null}

        {isLoading ? (
          <Txt variant="caption" tone="secondary">
            Lade Gewichtseinträge...
          </Txt>
        ) : (
          <Chart entries={entries} />
        )}

        <Card style={styles.history}>
          <View style={styles.historyHeader}>
            <Txt variant="subheading">Historie</Txt>
            <Txt variant="caption" tone="secondary">
              Privat und nur für dich sichtbar
            </Txt>
          </View>
          {entries.length === 0 ? (
            <Txt variant="caption" tone="secondary" style={styles.empty}>
              Noch keine Messungen vorhanden.
            </Txt>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Txt variant="body" weight="700">
                    {formatLogicalDate(entry.measured_on)}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {formatTime(entry.measured_at)}
                  </Txt>
                </View>
                <Txt variant="body" weight="700">
                  {formatWeight(entry.weight_kg)}
                </Txt>
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}
