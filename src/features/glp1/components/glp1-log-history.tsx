import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Card, Press, Txt } from '@/constants/ui';
import type { Glp1HistoryItem } from '@/features/glp1/domain/log-history';
import { getInjectionSiteLabel, isInjectionSite } from '@/features/glp1/domain/medication-options';
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

function formatHistoryTimestamp(timestamp: string, locale: string): string {
  return new Date(timestamp).toLocaleString(locale, {
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
  const { i18n, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <View style={styles.root}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t(isExpanded ? 'glp1.history.hide' : 'glp1.history.show')}
        onPress={() => setIsExpanded((current) => !current)}
        style={styles.toggle}>
        <Txt variant="body" tone="secondary">
          {t(isExpanded ? 'glp1.history.hide' : 'glp1.history.show')}
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
                <Card key={`medication-${log.id}`} padded={false} style={styles.entry}>
                  <Txt variant="body" weight="700">
                    {t('glp1.history.injection', {
                      medication: log.medication_name,
                      dose: log.dose ?? '–',
                      unit: log.unit,
                    })}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {formatHistoryTimestamp(log.administered_at, i18n.language)}
                    {isInjectionSite(log.injection_site)
                      ? ` · ${getInjectionSiteLabel(t, log.injection_site)}`
                      : ''}
                  </Txt>
                  {log.notes ? <Txt variant="body">{log.notes}</Txt> : null}
                  <View style={styles.actions}>
                    <Button
                      title={t('common.actions.edit')}
                      variant="link"
                      size="sm"
                      haptic="light"
                      accessibilityLabel={t('glp1.history.editInjection')}
                      onPress={() => onEditMedication(log)}
                    />
                    <Button
                      title={t('common.actions.delete')}
                      variant="danger"
                      size="sm"
                      flat
                      haptic="light"
                      accessibilityLabel={t('glp1.history.deleteInjection')}
                      onPress={() => onDeleteMedication(log)}
                    />
                  </View>
                </Card>
              );
            }

            const { log } = item;
            return (
              <Card key={`symptom-${log.id}`} padded={false} style={styles.entry}>
                <Txt variant="body" weight="700">
                  {t('glp1.history.symptoms', {
                    appetite: log.appetite_level ?? '–',
                    satiety: log.satiety_level ?? '–',
                  })}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatHistoryTimestamp(log.logged_at, i18n.language)} ·{' '}
                  {t('glp1.history.nausea', { value: log.nausea_level ?? 0 })}
                </Txt>
                {log.side_effects.length > 0 ? (
                  <Txt variant="body">{log.side_effects.join(' · ')}</Txt>
                ) : null}
                {log.notes ? <Txt variant="body">{log.notes}</Txt> : null}
                <View style={styles.actions}>
                  <Button
                    title={t('common.actions.edit')}
                    variant="link"
                    size="sm"
                    haptic="light"
                    accessibilityLabel={t('glp1.history.editSymptoms')}
                    onPress={() => onEditSymptom(log)}
                  />
                  <Button
                    title={t('common.actions.delete')}
                    variant="danger"
                    size="sm"
                    flat
                    haptic="light"
                    accessibilityLabel={t('glp1.history.deleteSymptoms')}
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
