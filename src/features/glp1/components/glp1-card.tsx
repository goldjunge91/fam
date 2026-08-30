import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { formatDaysSince } from '@/features/glp1/domain/format-days-since';
import { InjectionForm, type InjectionFormValue } from '@/features/glp1/forms/injection-form';
import { SymptomForm, type SymptomFormValue } from '@/features/glp1/forms/symptom-form';
import {
  useAddMedicationLogMutation,
  useAddSymptomLogMutation,
  useMedicationLogs,
  useSymptomLogs,
} from '@/features/glp1/hooks/glp1-api';

type Glp1CardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
};

export function Glp1Card({ userId, childProfileId }: Glp1CardProps) {
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [showSymptomForm, setShowSymptomForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: medLogs } = useMedicationLogs(userId, childProfileId);
  const { data: symptomLogs } = useSymptomLogs(userId, childProfileId);
  const addMedMutation = useAddMedicationLogMutation();
  const addSymptomMutation = useAddSymptomLogMutation();
  const latestMed = medLogs && medLogs.length > 0 ? medLogs[0] : null;
  const latestSymptom = symptomLogs && symptomLogs.length > 0 ? symptomLogs[0] : null;

  function saveInjection(value: InjectionFormValue) {
    if (!userId) return;
    addMedMutation.mutate(
      { userId, childProfileId, ...value },
      { onSuccess: () => setShowInjectForm(false) },
    );
  }

  function saveSymptoms(value: SymptomFormValue) {
    if (!userId) return;
    addSymptomMutation.mutate(
      { userId, childProfileId, ...value },
      { onSuccess: () => setShowSymptomForm(false) },
    );
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
              {latestSymptom.nausea_level && latestSymptom.nausea_level > 0 ? (
                <ThemedText type="caption" themeColor="warning">
                  Übelkeit: Stufe {latestSymptom.nausea_level}/5
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
          onPress={() => {
            setShowInjectForm(!showInjectForm);
            setShowSymptomForm(false);
          }}
          className="flex-1 py-two px-three rounded-xl bg-card border border-border items-center justify-center">
          <ThemedText type="labelBold">
            {showInjectForm ? 'Abbrechen' : '+ Injektion eintragen'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            setShowSymptomForm(!showSymptomForm);
            setShowInjectForm(false);
          }}
          className="flex-1 py-two px-three rounded-xl bg-card border border-border items-center justify-center">
          <ThemedText type="labelBold">
            {showSymptomForm ? 'Abbrechen' : '+ Symptome loggen'}
          </ThemedText>
        </Pressable>
      </View>

      {showInjectForm && (
        <InjectionForm isPending={addMedMutation.isPending} onSubmit={saveInjection} />
      )}
      {showSymptomForm && (
        <SymptomForm isPending={addSymptomMutation.isPending} onSubmit={saveSymptoms} />
      )}

      {(medLogs && medLogs.length > 0) || (symptomLogs && symptomLogs.length > 0) ? (
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

          {showHistory && (
            <View className="gap-two pt-two">
              {medLogs && medLogs.length > 0 && (
                <View className="gap-one">
                  <ThemedText type="labelBold" themeColor="textSecondary">
                    Letzte Injektionen:
                  </ThemedText>
                  {medLogs.slice(0, 3).map((log) => (
                    <View
                      key={log.id}
                      className="p-two rounded-lg bg-surface flex-row items-center justify-between border border-border">
                      <ThemedText type="small">
                        {log.medication_name} ({log.dose} {log.unit})
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {new Date(log.administered_at).toLocaleDateString('de-DE')}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}
