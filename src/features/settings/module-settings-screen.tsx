import { Pressable, Switch, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
import { getSettingsModules } from '@/constants/feature-registry';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { useFeatureAccess } from '@/features/settings/use-feature-access';

const SETTINGS_MODULES = getSettingsModules();

export function ModuleSettingsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { modules, isModuleLocked } = useFeatureAccess();
  const updateMutation = useUpdateModulePreferencesMutation();

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

      <View className="gap-two">
        {SETTINGS_MODULES.map((row) => {
          // Gesperrte Module bleiben sichtbar, der Switch ist deaktiviert.
          const locked = isModuleLocked(row.featureFlag);

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
