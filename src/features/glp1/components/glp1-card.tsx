import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { useSnackbar } from '@/components/ui/snackbar';
import { formatDaysSince } from '@/features/glp1/domain/format-days-since';
import {
  InjectionForm,
  type InjectionFormValue,
  type InjectionSite,
  MEDICATION_UNITS,
  type MedicationUnit,
} from '@/features/glp1/forms/injection-form';
import { SymptomForm, type SymptomFormValue } from '@/features/glp1/forms/symptom-form';
import {
  type MedicationLogRow,
  type SymptomLogRow,
  useAddMedicationLogMutation,
  useAddSymptomLogMutation,
  useDeleteMedicationLogMutation,
  useDeleteSymptomLogMutation,
  useMedicationLogs,
  useRestoreMedicationLogMutation,
  useRestoreSymptomLogMutation,
  useSymptomLogs,
  useUpdateMedicationLogMutation,
  useUpdateSymptomLogMutation,
} from '@/features/glp1/hooks/glp1-api';

type Glp1CardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
};

type ActiveForm =
  | { kind: 'medication'; log?: MedicationLogRow }
  | { kind: 'symptom'; log?: SymptomLogRow };

type HistoryItem =
  | { kind: 'medication'; timestamp: string; log: MedicationLogRow }
  | { kind: 'symptom'; timestamp: string; log: SymptomLogRow };

const INJECTION_SITE_LABELS = {
  abdomen: 'Bauch',
  thigh: 'Oberschenkel',
  upper_arm: 'Oberarm',
  other: 'Andere Stelle',
} as const satisfies Record<InjectionSite, string>;

function isInjectionSite(value: string | null): value is InjectionSite {
  return value !== null && value in INJECTION_SITE_LABELS;
}

function medicationUnit(value: string): MedicationUnit {
  for (const unit of MEDICATION_UNITS) {
    if (unit === value) return unit;
  }
  return 'mg';
}

function medicationFormValue(log: MedicationLogRow): InjectionFormValue {
  return {
    medicationName: log.medication_name,
    dose: log.dose,
    unit: medicationUnit(log.unit),
    injectionSite: isInjectionSite(log.injection_site) ? log.injection_site : null,
    administeredAt: log.administered_at,
    notes: log.notes,
  };
}

function symptomFormValue(log: SymptomLogRow): SymptomFormValue {
  return {
    appetiteLevel: log.appetite_level ?? 2,
    satietyLevel: log.satiety_level ?? 4,
    nauseaLevel: log.nausea_level ?? 0,
    sideEffects: log.side_effects,
    loggedAt: log.logged_at,
    notes: log.notes,
  };
}

function formatHistoryTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Glp1Card({ userId, childProfileId }: Glp1CardProps) {
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { showUndoSnackbar } = useSnackbar();
  const { data: medLogs } = useMedicationLogs(userId, childProfileId);
  const { data: symptomLogs } = useSymptomLogs(userId, childProfileId);
  const addMedMutation = useAddMedicationLogMutation();
  const addSymptomMutation = useAddSymptomLogMutation();
  const updateMedMutation = useUpdateMedicationLogMutation();
  const updateSymptomMutation = useUpdateSymptomLogMutation();
  const deleteMedMutation = useDeleteMedicationLogMutation();
  const deleteSymptomMutation = useDeleteSymptomLogMutation();
  const restoreMedMutation = useRestoreMedicationLogMutation();
  const restoreSymptomMutation = useRestoreSymptomLogMutation();
  const latestMed = medLogs && medLogs.length > 0 ? medLogs[0] : null;
  const latestSymptom = symptomLogs && symptomLogs.length > 0 ? symptomLogs[0] : null;

  const history: HistoryItem[] = [
    ...(medLogs ?? []).map((log) => ({
      kind: 'medication' as const,
      timestamp: log.administered_at,
      log,
    })),
    ...(symptomLogs ?? []).map((log) => ({
      kind: 'symptom' as const,
      timestamp: log.logged_at,
      log,
    })),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  const recentSites = (medLogs ?? [])
    .map((log) => log.injection_site)
    .filter(isInjectionSite)
    .filter((site, index, sites) => sites.indexOf(site) === index)
    .slice(0, 3);

  function saveInjection(value: InjectionFormValue) {
    if (!userId || activeForm?.kind !== 'medication') return;
    const input = { userId, childProfileId, ...value };
    const options = { onSuccess: () => setActiveForm(null) };
    if (activeForm.log) {
      updateMedMutation.mutate({ id: activeForm.log.id, ...input }, options);
    } else {
      addMedMutation.mutate(input, options);
    }
  }

  function saveSymptoms(value: SymptomFormValue) {
    if (!userId || activeForm?.kind !== 'symptom') return;
    const input = { userId, childProfileId, ...value };
    const options = { onSuccess: () => setActiveForm(null) };
    if (activeForm.log) {
      updateSymptomMutation.mutate({ id: activeForm.log.id, ...input }, options);
    } else {
      addSymptomMutation.mutate(input, options);
    }
  }

  function deleteMedication(log: MedicationLogRow) {
    if (!userId) return;
    const scope = { id: log.id, userId, childProfileId };
    deleteMedMutation.mutate(scope, {
      onSuccess: () => {
        showUndoSnackbar({
          message: 'Injektion gelöscht',
          onUndo: () => restoreMedMutation.mutate(scope),
        });
      },
    });
  }

  function deleteSymptom(log: SymptomLogRow) {
    if (!userId) return;
    const scope = { id: log.id, userId, childProfileId };
    deleteSymptomMutation.mutate(scope, {
      onSuccess: () => {
        showUndoSnackbar({
          message: 'Symptom-Log gelöscht',
          onUndo: () => restoreSymptomMutation.mutate(scope),
        });
      },
    });
  }

  return (
    <Card className="p-four gap-three">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-two">
          <ThemedText type="smallBold">💉 GLP-1 & Medikation</ThemedText>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Privat
        </ThemedText>
      </View>

      <View className="flex-row justify-between bg-surface p-three rounded-xl border border-border gap-two">
        <View className="flex-1">
          <ThemedText type="caption" themeColor="textSecondary">
            Letzte Injektion
          </ThemedText>
          {latestMed ? (
            <View className="mt-one">
              <ThemedText type="smallBold">
                {latestMed.medication_name} ({latestMed.dose} {latestMed.unit})
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {formatDaysSince(latestMed.administered_at)}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" className="mt-one">
              Keine Injektion erfasst
            </ThemedText>
          )}
        </View>

        <View className="flex-1">
          <ThemedText type="caption" themeColor="textSecondary">
            Letzter Sättigungs-Status
          </ThemedText>
          {latestSymptom ? (
            <View className="mt-one">
              <ThemedText type="smallBold">
                Appetit {latestSymptom.appetite_level}/5 · Sättigung {latestSymptom.satiety_level}
                /5
              </ThemedText>
              {(latestSymptom.nausea_level ?? 0) > 0 || latestSymptom.side_effects.length > 0 ? (
                <ThemedText type="caption" themeColor="warning">
                  {latestSymptom.side_effects.length > 0
                    ? latestSymptom.side_effects.join(' · ')
                    : `Übelkeit: Stufe ${latestSymptom.nausea_level}/5`}
                </ThemedText>
              ) : (
                <ThemedText type="caption" themeColor="success">
                  Keine Nebenwirkungen
                </ThemedText>
              )}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" className="mt-one">
              Kein Symptom-Log
            </ThemedText>
          )}
        </View>
      </View>

      <View className="flex-row gap-two">
        <Pressable
          onPress={() =>
            setActiveForm((current) =>
              current?.kind === 'medication' ? null : { kind: 'medication' },
            )
          }
          className="flex-1 py-two px-three rounded-xl bg-card border border-border items-center justify-center">
          <ThemedText type="labelBold">
            {activeForm?.kind === 'medication' ? 'Abbrechen' : '+ Injektion eintragen'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() =>
            setActiveForm((current) => (current?.kind === 'symptom' ? null : { kind: 'symptom' }))
          }
          className="flex-1 py-two px-three rounded-xl bg-card border border-border items-center justify-center">
          <ThemedText type="labelBold">
            {activeForm?.kind === 'symptom' ? 'Abbrechen' : '+ Symptome loggen'}
          </ThemedText>
        </Pressable>
      </View>

      {activeForm?.kind === 'medication' ? (
        <InjectionForm
          key={`medication-${activeForm.log?.id ?? 'new'}`}
          isPending={activeForm.log ? updateMedMutation.isPending : addMedMutation.isPending}
          initialValue={activeForm.log ? medicationFormValue(activeForm.log) : undefined}
          recentSites={recentSites}
          mode={activeForm.log ? 'edit' : 'create'}
          onSubmit={saveInjection}
        />
      ) : null}
      {activeForm?.kind === 'symptom' ? (
        <SymptomForm
          key={`symptom-${activeForm.log?.id ?? 'new'}`}
          isPending={
            activeForm.log ? updateSymptomMutation.isPending : addSymptomMutation.isPending
          }
          initialValue={activeForm.log ? symptomFormValue(activeForm.log) : undefined}
          mode={activeForm.log ? 'edit' : 'create'}
          onSubmit={saveSymptoms}
        />
      ) : null}

      {history.length > 0 ? (
        <View className="pt-one border-t border-border">
          <Pressable
            onPress={() => setShowHistory(!showHistory)}
            className="py-one flex-row items-center justify-between">
            <ThemedText type="small" themeColor="textSecondary">
              {showHistory ? 'Verlauf ausblenden' : 'Bisherigen Verlauf anzeigen'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {showHistory ? '▲' : '▼'}
            </ThemedText>
          </Pressable>

          {showHistory ? (
            <View className="gap-two pt-two">
              {history.slice(0, 10).map((item) => {
                if (item.kind === 'medication') {
                  const { log } = item;
                  return (
                    <View
                      key={`medication-${log.id}`}
                      className="p-two rounded-lg bg-surface border border-border gap-one">
                      <ThemedText type="smallBold">
                        Injektion · {log.medication_name} {log.dose} {log.unit}
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
                          onPress={() => setActiveForm({ kind: 'medication', log })}>
                          <ThemedText type="caption" themeColor="accent">
                            Bearbeiten
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Injektion löschen"
                          onPress={() => deleteMedication(log)}>
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
                      Symptome · Appetit {log.appetite_level}/5 · Sättigung {log.satiety_level}/5
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
                        onPress={() => setActiveForm({ kind: 'symptom', log })}>
                        <ThemedText type="caption" themeColor="accent">
                          Bearbeiten
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Symptome löschen"
                        onPress={() => deleteSymptom(log)}>
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
      ) : null}
    </Card>
  );
}
