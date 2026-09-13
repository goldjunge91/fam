import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Card, Press, Txt } from '@/constants/ui';
import type { Glp1HistoryItem } from '@/features/glp1/domain/log-history';
import { INJECTION_SITE_LABELS, isInjectionSite } from '@/features/glp1/domain/medication-options';
import type { MedicationLogRow, SymptomLogRow } from '@/features/glp1/hooks/glp1-api';

type Glp1LogHistoryProps = {
  items: Glp1HistoryItem<MedicationLogRow, SymptomLogRow>[];
  onEditMedication: (log: MedicationLogRow) => void;
  onDeleteMedication: (log: MedicationLogRow) => void;
  onEditSymptom: (log: SymptomLogRow) => void;
  onDeleteSymptom: (log: SymptomLogRow) => void;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    paddingTop: theme.space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  toggle: {
    minHeight: 44,
    paddingVertical: theme.space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
  },
  history: {
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  entry: {
    gap: theme.space.xs,
    padding: theme.space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.lg,
  },
}));

function formatHistoryTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Glp1LogHistory({
  items,
  onEditMedication,
  onDeleteMedication,
  onEditSymptom,
  onDeleteSymptom,
}: Glp1LogHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <View style={styles.root}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Verlauf ausblenden' : 'Bisherigen Verlauf anzeigen'}
        onPress={() => setIsExpanded((current) => !current)}
        style={styles.toggle}>
        <Txt variant="body" tone="secondary">
          {isExpanded ? 'Verlauf ausblenden' : 'Bisherigen Verlauf anzeigen'}
        </Txt>
        <Txt variant="body" tone="secondary">
          {isExpanded ? '▲' : '▼'}
        </Txt>
      </Press>

      {isExpanded ? (
        <View style={styles.history}>
          {items.slice(0, 10).map((item) => {
            if (item.kind === 'injection') {
              const { log } = item;
              return (
                <Card
                  key={`medication-${log.id}`}
                  padded={false}
                  elevation="none"
                  style={styles.entry}>
                  <Txt variant="body" weight="700">
                    Injektion · {log.medication_name} {log.dose ?? '–'} {log.unit}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {formatHistoryTimestamp(log.administered_at)}
                    {isInjectionSite(log.injection_site)
                      ? ` · ${INJECTION_SITE_LABELS[log.injection_site]}`
                      : ''}
                  </Txt>
                  {log.notes ? <Txt variant="body">{log.notes}</Txt> : null}
                  <View style={styles.actions}>
                    <Button
                      title="Bearbeiten"
                      variant="link"
                      size="sm"
                      haptic="light"
                      accessibilityLabel="Injektion bearbeiten"
                      onPress={() => onEditMedication(log)}
                    />
                    <Button
                      title="Löschen"
                      variant="danger"
                      size="sm"
                      flat
                      haptic="light"
                      accessibilityLabel="Injektion löschen"
                      onPress={() => onDeleteMedication(log)}
                    />
                  </View>
                </Card>
              );
            }

            const { log } = item;
            return (
              <Card key={`symptom-${log.id}`} padded={false} elevation="none" style={styles.entry}>
                <Txt variant="body" weight="700">
                  Symptome · Appetit {log.appetite_level ?? '–'}/5 · Sättigung{' '}
                  {log.satiety_level ?? '–'}/5
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatHistoryTimestamp(log.logged_at)} · Übelkeit {log.nausea_level ?? 0}/5
                </Txt>
                {log.side_effects.length > 0 ? (
                  <Txt variant="body">{log.side_effects.join(' · ')}</Txt>
                ) : null}
                {log.notes ? <Txt variant="body">{log.notes}</Txt> : null}
                <View style={styles.actions}>
                  <Button
                    title="Bearbeiten"
                    variant="link"
                    size="sm"
                    haptic="light"
                    accessibilityLabel="Symptome bearbeiten"
                    onPress={() => onEditSymptom(log)}
                  />
                  <Button
                    title="Löschen"
                    variant="danger"
                    size="sm"
                    flat
                    haptic="light"
                    accessibilityLabel="Symptome löschen"
                    onPress={() => onDeleteSymptom(log)}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
