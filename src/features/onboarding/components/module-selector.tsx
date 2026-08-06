import { Button, Column, Host, Spacer, Switch, Text } from '@expo/ui';
import { Text as RNText, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';

interface ModuleSelectorFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
  const theme = useTheme();
  const { state, updateModulesData } = useOnboarding();

  const toggle = (key: keyof typeof state.modules) => {
    updateModulesData({ [key]: !state.modules[key] });
  };

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text textStyle={{ ...styles.heading, color: theme.text }}>
          Welche Module möchtest du nutzen?
        </Text>
        <Text textStyle={{ ...styles.subheading, color: theme.textSecondary }}>
          Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
        </Text>

        <Spacer size={Spacing.three} />

        <View style={styles.moduleList}>
          <View style={[styles.moduleRow, { borderColor: theme.border }]}>
            <View style={styles.moduleTextCol}>
              <RNText style={[styles.moduleTitle, { color: theme.text }]}>
                🧊 Kühlschrank & Vorrat
              </RNText>
              <RNText style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.
              </RNText>
            </View>
            <Switch value={state.modules.fridge} onValueChange={() => toggle('fridge')} />
          </View>

          <View style={[styles.moduleRow, { borderColor: theme.border }]}>
            <View style={styles.moduleTextCol}>
              <RNText style={[styles.moduleTitle, { color: theme.text }]}>
                🛒 Geteilte Einkaufsliste
              </RNText>
              <RNText style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.
              </RNText>
            </View>
            <Switch
              value={state.modules.shoppingList}
              onValueChange={() => toggle('shoppingList')}
            />
          </View>

          <View style={[styles.moduleRow, { borderColor: theme.border }]}>
            <View style={styles.moduleTextCol}>
              <RNText style={[styles.moduleTitle, { color: theme.text }]}>
                🍎 Kalorienzähler & Tagebuch
              </RNText>
              <RNText style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.
              </RNText>
            </View>
            <Switch value={state.modules.calories} onValueChange={() => toggle('calories')} />
          </View>

          <View style={[styles.moduleRow, { borderColor: theme.border }]}>
            <View style={styles.moduleTextCol}>
              <RNText style={[styles.moduleTitle, { color: theme.text }]}>
                📖 Rezept-Manager & Meal-Planner
              </RNText>
              <RNText style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Rezepte anlegen, Portionsmengen berechnen und die Woche vorausplanen.
              </RNText>
            </View>
            <Switch value={state.modules.recipes} onValueChange={() => toggle('recipes')} />
          </View>
        </View>

        <Spacer size={Spacing.four} />

        <View style={styles.buttonRow}>
          <Button onPress={onNext}>Weiter</Button>
          <Button onPress={onSkip}>Überspringen</Button>
        </View>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 14,
  },
  moduleList: {
    gap: Spacing.two,
  },
  moduleRow: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moduleTextCol: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  moduleDesc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
