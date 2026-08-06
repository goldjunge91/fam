import { Button, Column, Host, Row, Spacer, Switch, Text } from '@expo/ui';
import { StyleSheet } from 'react';
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
        <Text style={[styles.heading, { color: theme.text }]}>
          Welche Module möchtest du nutzen?
        </Text>
        <Text style={[styles.subheading, { color: theme.textSecondary }]}>
          Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
        </Text>

        <Spacer height={Spacing.three} />

        <Column style={styles.moduleList}>
          <Row style={[styles.moduleRow, { borderColor: theme.border }]}>
            <Column style={styles.moduleTextCol}>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>
                🧊 Kühlschrank & Vorrat
              </Text>
              <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.
              </Text>
            </Column>
            <Switch value={state.modules.fridge} onValueChange={() => toggle('fridge')} />
          </Row>

          <Row style={[styles.moduleRow, { borderColor: theme.border }]}>
            <Column style={styles.moduleTextCol}>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>
                🛒 Geteilte Einkaufsliste
              </Text>
              <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.
              </Text>
            </Column>
            <Switch
              value={state.modules.shoppingList}
              onValueChange={() => toggle('shoppingList')}
            />
          </Row>

          <Row style={[styles.moduleRow, { borderColor: theme.border }]}>
            <Column style={styles.moduleTextCol}>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>
                🍎 Kalorienzähler & Tagebuch
              </Text>
              <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.
              </Text>
            </Column>
            <Switch value={state.modules.calories} onValueChange={() => toggle('calories')} />
          </Row>

          <Row style={[styles.moduleRow, { borderColor: theme.border }]}>
            <Column style={styles.moduleTextCol}>
              <Text style={[styles.moduleTitle, { color: theme.text }]}>
                📖 Rezept-Manager & Meal-Planner
              </Text>
              <Text style={[styles.moduleDesc, { color: theme.textSecondary }]}>
                Rezepte anlegen, Portionsmengen berechnen und die Woche vorausplanen.
              </Text>
            </Column>
            <Switch value={state.modules.recipes} onValueChange={() => toggle('recipes')} />
          </Row>
        </Column>

        <Spacer height={Spacing.four} />

        <Row style={styles.buttonRow}>
          <Button onPress={onNext}>Weiter</Button>
          <Button onPress={onSkip}>Überspringen</Button>
        </Row>
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
    marginTop: Spacing.one,
  },
  moduleList: {
    gap: Spacing.two,
  },
  moduleRow: {
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
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
