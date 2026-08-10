import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { useTheme } from '@/hooks/use-theme';

const MODULE_ROWS: { key: keyof ModulePreferences; icon: string; title: string; desc: string }[] = [
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
  },
  {
    key: 'recipes',
    icon: '📖',
    title: 'Rezepte',
    desc: 'Im Haushalt geteilte Rezeptsammlung.',
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

  const { data: modules, isLoading } = useModulePreferences(userId);
  const updateMutation = useUpdateModulePreferencesMutation();

  function toggle(key: keyof ModulePreferences) {
    if (!userId || !modules) return;
    updateMutation.mutate({ userId, modules: { [key]: !modules[key] } });
  }

  return (
    <Screen title="Module" back={{ label: 'Einstellungen', href: '/settings' }}>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Deaktivierte Module verschwinden aus der Navigation, deine Daten bleiben erhalten.
        </ThemedText>
      </Card>

      {isLoading || !modules ? (
        <ThemedText type="small" themeColor="textSecondary">
          Lade Einstellungen...
        </ThemedText>
      ) : (
        <View style={styles.moduleList}>
          {MODULE_ROWS.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => toggle(row.key)}
              style={[
                styles.moduleRow,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: modules[row.key] ? theme.accent : theme.border,
                },
              ]}>
              <View style={styles.moduleTextCol}>
                <ThemedText type="smallBold">
                  {row.icon} {row.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.desc}
                </ThemedText>
              </View>
              <Switch value={modules[row.key]} onValueChange={() => toggle(row.key)} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  moduleList: {
    gap: Spacing.two,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  moduleTextCol: {
    flex: 1,
    gap: 2,
  },
});
