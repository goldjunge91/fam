import { Pressable, Switch, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { getSettingsModules } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { useFeatureAccess } from '@/features/settings/use-feature-access';

const SETTINGS_MODULES = getSettingsModules();

export function ModuleSettingsScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
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
        <Txt variant="body" tone="secondary">
          Deaktivierte Module verschwinden aus der Navigation, deine Daten bleiben erhalten.
        </Txt>
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
              className="module-row"
              style={{
                backgroundColor: modules[row.key] ? colors.surfaceSoft : colors.surface,
                borderColor: colors.border,
              }}>
              <View className={`row-text ${locked ? 'module-row-locked-content' : ''}`}>
                <Txt variant="body" weight="700">
                  {row.icon} {row.title}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {row.desc}
                </Txt>
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
