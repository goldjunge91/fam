import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import {
  useAddMedicationLogMutation,
  useAddSymptomLogMutation,
  useMedicationLogs,
  useSymptomLogs,
} from '@/features/calorie-tracking/glp1-api';

type Glp1CardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
};

export function Glp1Card({ userId, childProfileId }: Glp1CardProps) {
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [showSymptomForm, setShowSymptomForm] = useState(false);

  // Form states
  const [medName, setMedName] = useState('Semaglutid');
  const [dose, setDose] = useState('0.5');
  const [unit, _setUnit] = useState('mg');

  const [appetite, setAppetite] = useState<number>(2);
  const [satiety, setSatiety] = useState<number>(4);
  const [nausea, setNausea] = useState<number>(0);

  const { data: medLogs } = useMedicationLogs(userId, childProfileId);
  const { data: symptomLogs } = useSymptomLogs(userId, childProfileId);

  const addMedMutation = useAddMedicationLogMutation();
  const addSymptomMutation = useAddSymptomLogMutation();

  const latestMed = medLogs && medLogs.length > 0 ? medLogs[0] : null;
  const latestSymptom = symptomLogs && symptomLogs.length > 0 ? symptomLogs[0] : null;

  function handleSaveMed() {
    if (!userId || !medName.trim()) return;
    const parsedDose = Number.parseFloat(dose.replace(',', '.'));
    addMedMutation.mutate(
      {
        userId,
        childProfileId,
        medicationName: medName.trim(),
        dose: Number.isNaN(parsedDose) ? null : parsedDose,
        unit,
      },
      {
        onSuccess: () => {
          setShowInjectForm(false);
        },
      },
    );
  }

  function handleSaveSymptom() {
    if (!userId) return;
    addSymptomMutation.mutate(
      {
        userId,
        childProfileId,
        appetiteLevel: appetite,
        satietyLevel: satiety,
        nauseaLevel: nausea,
      },
      {
        onSuccess: () => {
          setShowSymptomForm(false);
        },
      },
    );
  }

  function getDaysSince(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'heute';
    if (diffDays === 1) return 'vor 1 Tag';
    return `vor ${diffDays} Tagen`;
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

      {/* Status-Übersicht */}
      <View className="flex-row justify-between bg-surface/50 p-three rounded-xl gap-two">
        <View className="flex-1">
          <ThemedText type="caption" themeColor="textSecondary">
            Letzte Injektion
          </ThemedText>
          {latestMed ? (
            <View>
              <ThemedText type="smallBold">
                {latestMed.medication_name} ({latestMed.dose} {latestMed.unit})
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {getDaysSince(latestMed.administered_at)}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Keine Injektion erfasst
            </ThemedText>
          )}
        </View>

        <View className="flex-1">
          <ThemedText type="caption" themeColor="textSecondary">
            Letzter Sättigungs-Status
          </ThemedText>
          {latestSymptom ? (
            <View>
              <ThemedText type="smallBold">
                Appetit {latestSymptom.appetite_level}/5 · Sättigung {latestSymptom.satiety_level}/5
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
            <ThemedText type="small" themeColor="textSecondary">
              Kein Symptom-Log
            </ThemedText>
          )}
        </View>
      </View>

      {/* Aktions-Buttons */}
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

      {/* Formular Injektion */}
      {showInjectForm && (
        <View className="p-three bg-surface rounded-xl gap-two border border-border">
          <ThemedText type="labelBold">Injektion erfassen</ThemedText>
          <View className="flex-row gap-two">
            <TextInput
              value={medName}
              onChangeText={setMedName}
              placeholder="Medikament (z. B. Semaglutid)"
              className="flex-1 p-two bg-card rounded-lg border border-border text-foreground text-sm"
              placeholderTextColor="#888"
            />
            <TextInput
              value={dose}
              onChangeText={setDose}
              placeholder="Dosis"
              keyboardType="decimal-pad"
              className="w-20 p-two bg-card rounded-lg border border-border text-foreground text-sm text-center"
              placeholderTextColor="#888"
            />
          </View>
          <Pressable
            onPress={handleSaveMed}
            disabled={addMedMutation.isPending}
            className="py-two bg-primary rounded-xl items-center justify-center mt-one">
            <ThemedText type="labelBold" className="text-white">
              {addMedMutation.isPending ? 'Speichern...' : 'Injektion speichern'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* Formular Symptome */}
      {showSymptomForm && (
        <View className="p-three bg-surface rounded-xl gap-three border border-border">
          <ThemedText type="labelBold">Symptom- & Sättigungs-Verlauf</ThemedText>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Appetit (1 = kein Appetit, 5 = starker Heißhunger): {appetite}/5
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setAppetite(lvl)}
                  className={`w-10 h-8 rounded-lg items-center justify-center border ${
                    appetite === lvl ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}>
                  <ThemedText
                    type="labelBold"
                    className={appetite === lvl ? 'text-white' : undefined}>
                    {lvl}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Sättigungsgefühl (1 = kaum satt, 5 = sehr schnell satt): {satiety}/5
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setSatiety(lvl)}
                  className={`w-10 h-8 rounded-lg items-center justify-center border ${
                    satiety === lvl ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}>
                  <ThemedText
                    type="labelBold"
                    className={satiety === lvl ? 'text-white' : undefined}>
                    {lvl}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Übelkeit / Nebenwirkung (0 = keine, 5 = stark): {nausea}/5
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[0, 1, 2, 3, 4, 5].map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setNausea(lvl)}
                  className={`w-8 h-8 rounded-lg items-center justify-center border ${
                    nausea === lvl ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}>
                  <ThemedText
                    type="labelBold"
                    className={nausea === lvl ? 'text-white' : undefined}>
                    {lvl}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={handleSaveSymptom}
            disabled={addSymptomMutation.isPending}
            className="py-two bg-primary rounded-xl items-center justify-center mt-one">
            <ThemedText type="labelBold" className="text-white">
              {addSymptomMutation.isPending ? 'Speichern...' : 'Status speichern'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
