import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { Card } from '@/components/ui/card';
import { getSettingsModules } from '@/constants/feature-registry';
import { Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type ModulePreferences,
  useUpdateModulePreferencesMutation,
} from '@/features/settings/module-preferences';
import { useFeatureAccess } from '@/features/settings/use-feature-access';

const SETTINGS_MODULES = getSettingsModules();

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.space.sm,
  },
  moduleRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    padding: theme.space.lg,
    overflow: 'hidden',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs / 2,
  },
  lockedContent: {
    opacity: 0.3,
  },
}));

export function ModuleSettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { modules, isModuleLocked } = useFeatureAccess();
  const updateMutation = useUpdateModulePreferencesMutation();

  function toggle(key: keyof ModulePreferences) {
    if (!userId) return;
    updateMutation.mutate({ userId, modules: { [key]: !modules[key] } });
  }

  return (
    <Screen
      title={t('settings.groups.app.modules.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      {/* Hinweistext zur Ausblendung von Modulen */}
      <Card>
        <Txt variant="body" tone="secondary">
          {t('settings.groups.app.modules.disableHint')}
        </Txt>
      </Card>

      <View style={styles.list}>
        {SETTINGS_MODULES.map((row) => {
          // Gesperrte Module bleiben sichtbar, der Switch ist deaktiviert.
          const locked = isModuleLocked(row.featureFlag);

          return (
            <Press
              key={row.key}
              onPress={() => !locked && toggle(row.key)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={row.title}
              accessibilityState={{ disabled: locked, selected: modules[row.key] }}
              haptic="selection"
              selected={modules[row.key]}
              style={styles.moduleRow}>
              <View style={[styles.rowText, locked && styles.lockedContent]}>
                <Txt variant="body" weight="700">
                  {row.icon} {row.title}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {row.desc}
                </Txt>
              </View>
              <View style={locked ? styles.lockedContent : undefined}>
                <Switch
                  value={modules[row.key]}
                  onValueChange={() => toggle(row.key)}
                  disabled={locked}
                />
              </View>
              {locked && <ModuleLockedOverlay />}
            </Press>
          );
        })}
      </View>
    </Screen>
  );
}
