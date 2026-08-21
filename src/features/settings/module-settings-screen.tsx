import { Pressable, Switch, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { withAlpha } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  DEFAULT_MODULE_PREFERENCES,
  type ModulePreferences,
  useModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { useTheme } from '@/hooks/use-theme';
import { type FeatureFlagKey, useFeatureFlag } from '@/lib/posthog';

const MODULE_ROWS: {
  key: keyof ModulePreferences;
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

/**
 * Modul-Aktivierung (#95) ausserhalb des Onboardings — loest das dort
 * gegebene Versprechen ein ("kannst du später in den Einstellungen
 * anpassen"). Dashboard und Einstellungen sind bewusst nicht abwaehlbar,
 * siehe `docs/VISION.md`, und tauchen deshalb hier nicht auf.
 */
export function ModuleSettingsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: rawModules } = useModulePreferences(userId);
  const modules = rawModules ?? DEFAULT_MODULE_PREFERENCES;
  const updateMutation = useUpdateModulePreferencesMutation();

  // Feste, bekannte Flags — kein dynamischer Lookup pro Zeile, damit die
  // Anzahl der Hook-Aufrufe zwischen Renders stabil bleibt (Rules of Hooks).
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
      {/* Hinweistext zur Ausblendung von Modulen */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Deaktivierte Module verschwinden aus der Navigation, deine Daten bleiben erhalten.
        </ThemedText>
      </Card>

      {/* Liste aller App-Module mit Toggle-Schaltern (Vorrat, Einkauf, Tagebuch, Rezepte, Meal-Planner) */}
      <View className="gap-two">
        {MODULE_ROWS.map((row) => {
          // Gesperrt = das Modul wird gerade schrittweise ausgerollt und ist
          // fuer diesen Nutzer noch nicht freigeschaltet (#183) — unabhaengig
          // von seiner eigenen Praeferenz. Karte bleibt sichtbar, Switch wird
          // per grauer Ueberlagerung unbedienbar (Variante A).
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
    </Screen>
  );
}
