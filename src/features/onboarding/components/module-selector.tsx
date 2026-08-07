import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/button';
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
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.text }]}>Welche Module möchtest du nutzen?</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
      </Text>

      <View style={styles.moduleList}>
        <Pressable
          onPress={() => toggle('fridge')}
          style={[
            styles.moduleRow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: state.modules.fridge ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.moduleTextCol}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>🧊 Kühlschrank & Vorrat</Text>
            <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
              Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.
            </Text>
          </View>
          <Switch value={state.modules.fridge} onValueChange={() => toggle('fridge')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('shoppingList')}
          style={[
            styles.moduleRow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: state.modules.shoppingList ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.moduleTextCol}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              🛒 Geteilte Einkaufsliste
            </Text>
            <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
              Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.
            </Text>
          </View>
          <Switch value={state.modules.shoppingList} onValueChange={() => toggle('shoppingList')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('calories')}
          style={[
            styles.moduleRow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: state.modules.calories ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.moduleTextCol}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              🍎 Kalorienzähler & Tagebuch
            </Text>
            <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
              Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.
            </Text>
          </View>
          <Switch value={state.modules.calories} onValueChange={() => toggle('calories')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('recipes')}
          style={[
            styles.moduleRow,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: state.modules.recipes ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.moduleTextCol}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              📖 Rezept-Manager & Meal-Planner
            </Text>
            <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
              Rezepte anlegen, Portionsmengen berechnen und die Woche vorausplanen.
            </Text>
          </View>
          <Switch value={state.modules.recipes} onValueChange={() => toggle('recipes')} />
        </Pressable>
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button label="Weiter" onPress={onNext} />
        </View>
        <View style={styles.buttonCol}>
          <Button label="Überspringen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
  },
  moduleList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
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
    fontSize: 15,
    fontWeight: '700',
  },
  moduleDesc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  buttonCol: {
    flex: 1,
  },
});
