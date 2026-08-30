import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
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
    <View className="pt-one border-t border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Verlauf ausblenden' : 'Bisherigen Verlauf anzeigen'}
        onPress={() => setIsExpanded((current) => !current)}
        className="py-one flex-row items-center justify-between">
        <ThemedText type="small" themeColor="textSecondary">
          {isExpanded ? 'Verlauf ausblenden' : 'Bisherigen Verlauf anzeigen'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {isExpanded ? '▲' : '▼'}
        </ThemedText>
      </Pressable>

      {isExpanded ? (
        <View className="gap-two pt-two">
          {items.slice(0, 10).map((item) => {
            if (item.kind === 'injection') {
              const { log } = item;
              return (
                <View
                  key={`medication-${log.id}`}
                  className="p-two rounded-lg bg-surface border border-border gap-one">
                  <ThemedText type="smallBold">
                    Injektion · {log.medication_name} {log.dose ?? '–'} {log.unit}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatHistoryTimestamp(log.administered_at)}
                    {isInjectionSite(log.injection_site)
                      ? ` · ${INJECTION_SITE_LABELS[log.injection_site]}`
                      : ''}
                  </ThemedText>
                  {log.notes ? <ThemedText type="small">{log.notes}</ThemedText> : null}
                  <View className="flex-row gap-three">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Injektion bearbeiten"
                      onPress={() => onEditMedication(log)}>
                      <ThemedText type="caption" themeColor="accent">
                        Bearbeiten
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Injektion löschen"
                      onPress={() => onDeleteMedication(log)}>
                      <ThemedText type="caption" themeColor="danger">
                        Löschen
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              );
            }

            const { log } = item;
            return (
              <View
                key={`symptom-${log.id}`}
                className="p-two rounded-lg bg-surface border border-border gap-one">
                <ThemedText type="smallBold">
                  Symptome · Appetit {log.appetite_level ?? '–'}/5 · Sättigung{' '}
                  {log.satiety_level ?? '–'}/5
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatHistoryTimestamp(log.logged_at)} · Übelkeit {log.nausea_level ?? 0}/5
                </ThemedText>
                {log.side_effects.length > 0 ? (
                  <ThemedText type="small">{log.side_effects.join(' · ')}</ThemedText>
                ) : null}
                {log.notes ? <ThemedText type="small">{log.notes}</ThemedText> : null}
                <View className="flex-row gap-three">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Symptome bearbeiten"
                    onPress={() => onEditSymptom(log)}>
                    <ThemedText type="caption" themeColor="accent">
                      Bearbeiten
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Symptome löschen"
                    onPress={() => onDeleteSymptom(log)}>
                    <ThemedText type="caption" themeColor="danger">
                      Löschen
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
