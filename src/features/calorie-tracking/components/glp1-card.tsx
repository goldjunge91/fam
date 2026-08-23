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
import { useTheme } from '@/hooks/use-theme';

const COMMON_MEDICATIONS = ['Semaglutid', 'Tirzepatid', 'Liraglutid'];
const COMMON_DOSES = ['0.25', '0.5', '1.0', '1.7', '2.4'];

type Glp1CardProps = {
  userId: string | undefined;
  childProfileId?: string | null;
};

export function Glp1Card({ userId, childProfileId }: Glp1CardProps) {
  const theme = useTheme();
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [showSymptomForm, setShowSymptomForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [medName, setMedName] = useState('Semaglutid');
  const [customMed, setCustomMed] = useState('');
  const [dose, setDose] = useState('0.5');
  const [customDose, setCustomDose] = useState('');
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

  const effectiveMedName = medName === 'Andere' ? customMed : medName;
  const effectiveDose = dose === 'Andere' ? customDose : dose;

  function handleSaveMed() {
    if (!userId || !effectiveMedName.trim()) return;
    const parsedDose = Number.parseFloat(effectiveDose.replace(',', '.'));
    addMedMutation.mutate(
      {
        userId,
        childProfileId,
        medicationName: effectiveMedName.trim(),
        dose: Number.isNaN(parsedDose) ? null : parsedDose,
        unit,
      },
      {
        onSuccess: () => {
          setShowInjectForm(false);
          setCustomMed('');
          setCustomDose('');
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
                {getDaysSince(latestMed.administered_at)}
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
        <View className="p-three bg-surface rounded-xl gap-three border border-border">
          <ThemedText type="labelBold">Injektion erfassen</ThemedText>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Medikament auswählen:
            </ThemedText>
            <View className="flex-row flex-wrap gap-two">
              {[...COMMON_MEDICATIONS, 'Andere'].map((name) => {
                const isSelected = medName === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setMedName(name)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="py-one px-three rounded-xl border">
                    <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                      {name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {medName === 'Andere' && (
              <TextInput
                value={customMed}
                onChangeText={setCustomMed}
                placeholder="Name des Medikaments"
                className="p-two bg-card rounded-lg border border-border text-sm mt-one"
                placeholderTextColor="#888"
              />
            )}
          </View>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Dosis (mg):
            </ThemedText>
            <View className="flex-row flex-wrap gap-two">
              {[...COMMON_DOSES, 'Andere'].map((d) => {
                const isSelected = dose === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDose(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="py-one px-three rounded-xl border">
                    <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                      {d === 'Andere' ? 'Andere' : `${d} mg`}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {dose === 'Andere' && (
              <TextInput
                value={customDose}
                onChangeText={setCustomDose}
                placeholder="z. B. 0.75"
                keyboardType="decimal-pad"
                className="p-two bg-card rounded-lg border border-border text-sm mt-one"
                placeholderTextColor="#888"
              />
            )}
          </View>

          <View className="p-two rounded-lg bg-card border border-border flex-row items-center justify-between">
            <ThemedText type="small" themeColor="textSecondary">
              Ausgewählt:
            </ThemedText>
            <ThemedText type="smallBold">
              {effectiveMedName || '–'} ({effectiveDose || '–'} mg)
            </ThemedText>
          </View>

          <Pressable
            onPress={handleSaveMed}
            disabled={addMedMutation.isPending || !effectiveMedName.trim() || !effectiveDose.trim()}
            style={{ backgroundColor: theme.accent }}
            className="py-three rounded-xl items-center justify-center mt-one">
            <ThemedText type="labelBold" themeColor="onAccent">
              {addMedMutation.isPending ? 'Speichern...' : 'Injektion speichern'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {showSymptomForm && (
        <View className="p-three bg-surface rounded-xl gap-three border border-border">
          <ThemedText type="labelBold">Symptom- & Sättigungs-Verlauf</ThemedText>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Appetit (1 = kein Appetit, 5 = starker Heißhunger):
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = appetite === lvl;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setAppetite(lvl)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="flex-1 h-9 rounded-xl items-center justify-center border">
                    <ThemedText type="labelBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                      {lvl}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Sättigungsgefühl (1 = kaum satt, 5 = sehr schnell satt):
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = satiety === lvl;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setSatiety(lvl)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="flex-1 h-9 rounded-xl items-center justify-center border">
                    <ThemedText type="labelBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                      {lvl}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-one">
            <ThemedText type="caption" themeColor="textSecondary">
              Übelkeit / Nebenwirkung (0 = keine, 5 = stark):
            </ThemedText>
            <View className="flex-row gap-two justify-between">
              {[0, 1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = nausea === lvl;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setNausea(lvl)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="flex-1 h-9 rounded-xl items-center justify-center border">
                    <ThemedText type="labelBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                      {lvl}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="p-two rounded-lg bg-card border border-border flex-row items-center justify-between">
            <ThemedText type="small" themeColor="textSecondary">
              Ausgewählt:
            </ThemedText>
            <ThemedText type="smallBold">
              Appetit {appetite}/5 · Sättigung {satiety}/5 · Übelkeit {nausea}/5
            </ThemedText>
          </View>

          <Pressable
            onPress={handleSaveSymptom}
            disabled={addSymptomMutation.isPending}
            style={{ backgroundColor: theme.accent }}
            className="py-three rounded-xl items-center justify-center mt-one">
            <ThemedText type="labelBold" themeColor="onAccent">
              {addSymptomMutation.isPending ? 'Speichern...' : 'Status speichern'}
            </ThemedText>
          </Pressable>
        </View>
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
