import { Pressable, Switch, Text, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type FeatureFlagKey, useFeatureFlag } from '@/lib/posthog';
import { useOnboarding } from '../context/onboarding-context';

interface ModuleSelectorFormProps {
  onNext: () => void;
  onSkip: () => void;
}

const MODULE_ROWS: {
  key: 'fridge' | 'shoppingList' | 'calories' | 'recipes' | 'mealPlanner';
  icon: string;
  title: string;
  desc: string;
  /** Remote-Gate (#183) — nur fuer gestaffelt ausgerollte Module, siehe ModuleGate. */
  featureFlag?: FeatureFlagKey;
}[] = [
  {
    key: 'fridge',
    icon: '🧊',
    title: 'Kühlschrank & Vorrat',
    desc: 'Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.',
  },
  {
    key: 'shoppingList',
    icon: '🛒',
    title: 'Geteilte Einkaufsliste',
    desc: 'Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.',
  },
  {
    key: 'calories',
    icon: '🍎',
    title: 'Kalorienzähler & Tagebuch',
    desc: 'Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.',
    featureFlag: 'module-calories',
  },
  {
    key: 'recipes',
    icon: '📖',
    title: 'Rezept-Manager',
    desc: 'Rezepte anlegen und Portionsmengen berechnen.',
    featureFlag: 'module-recipes',
  },
  {
    key: 'mealPlanner',
    icon: '🗓️',
    title: 'Meal-Planner',
    desc: 'Die Woche vorausplanen und Mahlzeiten Mitgliedern zuordnen.',
    featureFlag: 'module-meal-planner',
  },
];

export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
  const theme = useTheme();
  const { state, updateModulesData } = useOnboarding();

  // Feste, bekannte Flags — kein dynamischer Lookup pro Zeile, damit die
  // Anzahl der Hook-Aufrufe zwischen Renders stabil bleibt (Rules of Hooks).
  const featureFlags: Partial<Record<FeatureFlagKey, boolean>> = {
    'module-recipes': useFeatureFlag('module-recipes', false),
    'module-meal-planner': useFeatureFlag('module-meal-planner', false),
    'module-calories': useFeatureFlag('module-calories', false),
  };

  const toggle = (key: keyof typeof state.modules) => {
    updateModulesData({ [key]: !state.modules[key] });
  };

  return (
    <View className="gap-three">
      <Text className="perm-heading">Welche Module möchtest du nutzen?</Text>
      <Text className="perm-subheading">
        Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
      </Text>

      <View className="perm-list">
        {MODULE_ROWS.map((row) => {
          // Gesperrt = das Modul wird gerade schrittweise ausgerollt und ist
          // fuer diesen Nutzer noch nicht freigeschaltet (#183) — Karte
          // bleibt sichtbar, Switch wird per grauer Ueberlagerung unbedienbar.
          const locked = row.featureFlag !== undefined && !featureFlags[row.featureFlag];

          return (
            <Pressable
              key={row.key}
              onPress={() => !locked && toggle(row.key)}
              disabled={locked}
              className={`onboard-module-row ${state.modules[row.key] ? 'module-row-selected' : 'module-row-idle'}`}>
              <View className={`perm-text-col ${locked ? 'module-row-locked-content' : ''}`}>
                <Text className="onboard-module-title">
                  {row.icon} {row.title}
                </Text>
                <Text className="onboard-module-desc">{row.desc}</Text>
              </View>
              <View className={locked ? 'module-row-locked-content' : undefined}>
                <Switch
                  value={state.modules[row.key]}
                  onValueChange={() => toggle(row.key)}
                  disabled={locked}
                />
              </View>
              {locked && (
                <View
                  className="module-row-locked-overlay"
                  style={{ backgroundColor: withAlpha(theme.backgroundElement, 0.4) }}>
                  <View className="module-row-locked-pill" style={{ backgroundColor: theme.text }}>
                    <View className="module-row-locked-pill-dot" />
                    <ThemedText type="smallBold" style={{ color: theme.background }}>
                      Demnächst verfügbar
                    </ThemedText>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View className="perm-button-row">
        <View className="flex-1">
          <Button label="Weiter" onPress={onNext} />
        </View>
        <View className="flex-1">
          <Button label="Überspringen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
