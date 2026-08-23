import { Pressable, Switch, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-provider';
import {
  DEFAULT_MODULE_PREFERENCES,
  type ModulePreferences,
  useModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { type FeatureFlagKey, useFeatureFlag } from '@/lib/posthog';

const MODULE_ROWS: {
  key: keyof ModulePreferences;
  icon: string;
  title: string;
  desc: string;
  /** Optionales Gate fuer gestaffelt ausgerollte Module. */
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
    title: 'Rezepte',
    desc: 'Im Haushalt geteilte Rezeptsammlung.',
    featureFlag: 'module-recipes',
  },
  {
    key: 'mealPlanner',
    icon: '🗓️',
    title: 'Meal-Planner',
    desc: 'Wochenplanung fuer den Haushalt, Mahlzeiten Mitgliedern zuordnen.',
    featureFlag: 'module-meal-planner',
  },
];

/** Verwaltet die Module, die `ModuleGate` ausblenden kann. */
export function ModuleSettingsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: rawModules } = useModulePreferences(userId);
  const modules = rawModules ?? DEFAULT_MODULE_PREFERENCES;
  const updateMutation = useUpdateModulePreferencesMutation();

  // Feste Hook-Aufrufe halten ihre Anzahl zwischen Renders stabil.
  const featureFlags: Partial<Record<FeatureFlagKey, boolean>> = {
    'module-recipes': useFeatureFlag('module-recipes', false),
    'module-meal-planner': useFeatureFlag('module-meal-planner', false),
    'module-calories': useFeatureFlag('module-calories', false),
  };

  function toggle(key: keyof ModulePreferences) {
    if (!userId) return;
    updateMutation.mutate({ userId, modules: { [key]: !modules[key] } });
  }

  return (
    <Screen title="Module" back={{ label: 'Einstellungen', href: '/settings' }} backStyle="icon">
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Deaktivierte Module verschwinden aus der Navigation, deine Daten bleiben erhalten.
        </ThemedText>
      </Card>

      <View className="gap-two">
        {MODULE_ROWS.map((row) => {
          // Remote-Gates sperren die Karte unabhaengig von der Nutzerpraeferenz.
          const locked = row.featureFlag !== undefined && !featureFlags[row.featureFlag];

          return (
            <Pressable
              key={row.key}
              onPress={() => !locked && toggle(row.key)}
              disabled={locked}
              className={`module-row ${modules[row.key] ? 'module-row-selected' : 'module-row-idle'}`}>
              <View className={`row-text ${locked ? 'module-row-locked-content' : ''}`}>
                <ThemedText type="smallBold">
                  {row.icon} {row.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.desc}
                </ThemedText>
              </View>
              <View className={locked ? 'module-row-locked-content' : undefined}>
                <Switch
                  value={modules[row.key]}
                  onValueChange={() => toggle(row.key)}
                  disabled={locked}
                />
              </View>
              {locked && <ModuleLockedOverlay />}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
