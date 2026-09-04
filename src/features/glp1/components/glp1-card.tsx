import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { useSnackbar } from '@/components/ui/snackbar';
import { Txt } from '@/constants/ui';
import { CorrelationMenuItem } from '@/features/glp1/components/correlation-menu-item';
import { Glp1LogHistory } from '@/features/glp1/components/glp1-log-history';
import { formatDaysSince } from '@/features/glp1/domain/format-days-since';
import { type Glp1HistoryItem, sortGlp1History } from '@/features/glp1/domain/log-history';
import { isInjectionSite, toMedicationUnit } from '@/features/glp1/domain/medication-options';
import { InjectionForm, type InjectionFormValue } from '@/features/glp1/forms/injection-form';
import { SymptomForm, type SymptomFormValue } from '@/features/glp1/forms/symptom-form';
import {
  type MedicationLogRow,
  type SymptomLogRow,
  useAddMedicationLogMutation,
  useAddSymptomLogMutation,
  useDeleteMedicationLogMutation,
  useDeleteSymptomLogMutation,
  useMedicationLogs,
  useRecentMedicationLogs,
  useRecentSymptomLogs,
  useRestoreMedicationLogMutation,
  useRestoreSymptomLogMutation,
  useSymptomLogs,
  useUpdateMedicationLogMutation,
  useUpdateSymptomLogMutation,
} from '@/features/glp1/hooks/glp1-api';
import { getLogicalDateForTimestamp } from '@/features/tracking/domain/day-boundary';

type Glp1CardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
  logicalDate?: string;
  dayStartTime?: string;
};

type ActiveForm =
  | { kind: 'injection'; log?: MedicationLogRow }
  | { kind: 'symptom'; log?: SymptomLogRow };

function injectionFormValue(log: MedicationLogRow): InjectionFormValue {
  return {
    medicationName: log.medication_name,
    dose: log.dose ?? 0.5,
    unit: toMedicationUnit(log.unit),
    injectionSite: isInjectionSite(log.injection_site) ? log.injection_site : null,
    administeredAt: log.administered_at,
    notes: log.notes,
  };
}

function newInjectionFormValue(log: MedicationLogRow): InjectionFormValue {
  return {
    ...injectionFormValue(log),
    administeredAt: new Date().toISOString(),
    notes: null,
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

export function Glp1Card({
  userId,
  childProfileId,
  logicalDate,
  dayStartTime = '00:00',
}: Glp1CardProps) {
  const { colors } = useTheme();
  const selectedLogicalDate = logicalDate ?? getLogicalDateForTimestamp(new Date(), dayStartTime);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const { showUndoSnackbar } = useSnackbar();
  const { data: injectionLogs } = useMedicationLogs(
    userId,
    childProfileId,
    logicalDate,
    dayStartTime,
  );
  const { data: recentInjectionLogs } = useRecentMedicationLogs(userId, childProfileId);
  const { data: symptomLogs } = useSymptomLogs(userId, childProfileId, logicalDate, dayStartTime);
  const { data: recentSymptomLogs } = useRecentSymptomLogs(userId, childProfileId);
  const addInjectionMutation = useAddMedicationLogMutation();
  const addSymptomMutation = useAddSymptomLogMutation();
  const updateInjectionMutation = useUpdateMedicationLogMutation();
  const updateSymptomMutation = useUpdateSymptomLogMutation();
  const deleteInjectionMutation = useDeleteMedicationLogMutation();
  const deleteSymptomMutation = useDeleteSymptomLogMutation();
  const restoreInjectionMutation = useRestoreMedicationLogMutation();
  const restoreSymptomMutation = useRestoreSymptomLogMutation();
  const latestInjection =
    recentInjectionLogs && recentInjectionLogs.length > 0 ? recentInjectionLogs[0] : null;
  const latestSymptom =
    recentSymptomLogs && recentSymptomLogs.length > 0 ? recentSymptomLogs[0] : null;

  const history: Glp1HistoryItem<MedicationLogRow, SymptomLogRow>[] = sortGlp1History<
    MedicationLogRow,
    SymptomLogRow
  >([
    ...(injectionLogs ?? []).map((log) => ({
      kind: 'injection' as const,
      timestamp: log.administered_at,
      log,
    })),
    ...(symptomLogs ?? []).map((log) => ({
      kind: 'symptom' as const,
      timestamp: log.logged_at,
      log,
    })),
  ]);

  const recentSites = (recentInjectionLogs ?? [])
    .map((log) => log.injection_site)
    .filter(isInjectionSite)
    .filter((site, index, sites) => sites.indexOf(site) === index)
    .slice(0, 3);

  function saveInjection(value: InjectionFormValue) {
    if (!userId || activeForm?.kind !== 'injection') return;
    const input = { userId, childProfileId, ...value };
    const options = { onSuccess: () => setActiveForm(null) };
    if (activeForm.log) {
      updateInjectionMutation.mutate({ id: activeForm.log.id, ...input }, options);
    } else {
      addInjectionMutation.mutate(input, options);
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

  function deleteInjection(log: MedicationLogRow) {
    if (!userId) return;
    const scope = { id: log.id, userId, childProfileId };
    deleteInjectionMutation.mutate(scope, {
      onSuccess: () => {
        showUndoSnackbar({
          message: 'Injektion gelöscht',
          onUndo: () => restoreInjectionMutation.mutate(scope),
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
          <Txt variant="body" weight="700">
            💉 GLP-1 & Medikation
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          Privat
        </Txt>
      </View>

      <View
        className="flex-row justify-between p-three rounded-xl border gap-two"
        style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}>
        <View className="flex-1">
          <Txt variant="caption" tone="secondary">
            Letzte Injektion
          </Txt>
          {latestInjection ? (
            <View className="mt-one">
              <Txt variant="body" weight="700">
                {latestInjection.medication_name} ({latestInjection.dose} {latestInjection.unit})
              </Txt>
              <Txt variant="caption" tone="secondary">
                {formatDaysSince(latestInjection.administered_at)}
              </Txt>
            </View>
          ) : (
            <Txt variant="body" tone="secondary" className="mt-one">
              Keine Injektion erfasst
            </Txt>
          )}
        </View>

        <View className="flex-1">
          <Txt variant="caption" tone="secondary">
            Letzter Sättigungs-Status
          </Txt>
          {latestSymptom ? (
            <View className="mt-one">
              <Txt variant="body" weight="700">
                Appetit {latestSymptom.appetite_level}/5 · Sättigung {latestSymptom.satiety_level}
                /5
              </Txt>
              {(latestSymptom.nausea_level ?? 0) > 0 || latestSymptom.side_effects.length > 0 ? (
                <Txt variant="caption" tone="warning">
                  {latestSymptom.side_effects.length > 0
                    ? latestSymptom.side_effects.join(' · ')
                    : `Übelkeit: Stufe ${latestSymptom.nausea_level}/5`}
                </Txt>
              ) : (
                <Txt variant="caption" tone="success">
                  Keine Nebenwirkungen
                </Txt>
              )}
            </View>
          ) : (
            <Txt variant="body" tone="secondary" className="mt-one">
              Kein Symptom-Log
            </Txt>
          )}
        </View>
      </View>

      <CorrelationMenuItem
        logicalDate={selectedLogicalDate}
        dayStartTime={dayStartTime}
        childProfileId={childProfileId}
      />

      <View className="flex-row gap-two">
        <Pressable
          onPress={() =>
            setActiveForm((current) =>
              current?.kind === 'injection' ? null : { kind: 'injection' },
            )
          }
          className="flex-1 py-two px-three rounded-xl border items-center justify-center"
          style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}>
          <Txt variant="label" weight="700">
            {activeForm?.kind === 'injection' ? 'Abbrechen' : '+ Injektion eintragen'}
          </Txt>
        </Pressable>
        <Pressable
          onPress={() =>
            setActiveForm((current) => (current?.kind === 'symptom' ? null : { kind: 'symptom' }))
          }
          className="flex-1 py-two px-three rounded-xl border items-center justify-center"
          style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}>
          <Txt variant="label" weight="700">
            {activeForm?.kind === 'symptom' ? 'Abbrechen' : '+ Symptome loggen'}
          </Txt>
        </Pressable>
      </View>

      {activeForm?.kind === 'injection' ? (
        <InjectionForm
          key={`medication-${activeForm.log?.id ?? 'new'}`}
          isPending={
            activeForm.log ? updateInjectionMutation.isPending : addInjectionMutation.isPending
          }
          initialValue={
            activeForm.log
              ? injectionFormValue(activeForm.log)
              : latestInjection
                ? newInjectionFormValue(latestInjection)
                : undefined
          }
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

      <Glp1LogHistory
        items={history}
        onEditMedication={(log) => setActiveForm({ kind: 'injection', log })}
        onDeleteMedication={deleteInjection}
        onEditSymptom={(log) => setActiveForm({ kind: 'symptom', log })}
        onDeleteSymptom={deleteSymptom}
      />
    </Card>
  );
}
