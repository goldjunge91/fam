import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { DEFAULT_PORTIONS_PER_PERSON } from '@/features/meal-planner/servings';
import { usePortionsPerPerson, useSetPortionsPerPerson } from '@/features/meal-planner/settings';

/**
 * Umrechnungsfaktor Portionen/Person fuer den Meal-Planner (#130-AC:
 * "Standard 1,25 Portionen/Person, in den Einstellungen änderbar").
 */
export function MealPlannerSettingsScreen() {
  const { data: current, isLoading } = usePortionsPerPerson();
  const setPortionsPerPerson = useSetPortionsPerPerson();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (current !== undefined) setValue(String(current));
  }, [current]);

  const parsed = Number(value);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  async function handleSave() {
    if (!isValid) return;
    await setPortionsPerPerson(parsed);
    setSaved(true);
  }

  return (
    <Screen title="Portionen pro Person" back={{ label: 'Einstellungen' }} backStyle="icon">
      <View className="gap-three">
        <ThemedText themeColor="textSecondary">
          Im Personen-Modus des Wochenplans wird die Personenzahl mit diesem Faktor in Portionen
          umgerechnet (Standard: {DEFAULT_PORTIONS_PER_PERSON}).
        </ThemedText>

        {isLoading ? null : (
          <TextField
            label="Portionen pro Person"
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setSaved(false);
            }}
            keyboardType="decimal-pad"
            error={!isValid && value.length > 0 ? 'Muss größer als 0 sein.' : undefined}
          />
        )}

        <Button label="Speichern" onPress={handleSave} disabled={!isValid} />
        {saved ? (
          <ThemedText type="small" themeColor="accent">
            Gespeichert.
          </ThemedText>
        ) : null}
      </View>
    </Screen>
  );
}
