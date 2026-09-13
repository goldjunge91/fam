import { Switch, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { getSettingsModules } from '@/constants/feature-registry';
import { Button, Press, Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useOnboarding } from '../onboarding-store';

interface ModuleSelectorFormProps {
  onNext: () => void;
  onSkip: () => void;
}

const SETTINGS_MODULES = getSettingsModules();

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.lg,
  },
  list: {
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  moduleRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    padding: theme.space.lg,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
    overflow: 'hidden',
  },
  moduleSelected: {
    borderColor: theme.accent,
  },
  moduleIdle: {
    borderColor: theme.border,
  },
  moduleCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: theme.space.sm,
  },
  moduleDescription: {
    marginTop: theme.space.xs / 2,
  },
  lockedContent: {
    opacity: 0.3,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  flex: {
    flex: 1,
  },
}));

export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
  const { state, updateModulesData } = useOnboarding();
  const { isModuleLocked } = useFeatureAccess();

  const toggle = (key: keyof typeof state.modules) => {
    updateModulesData({ [key]: !state.modules[key] });
  };

  return (
    <View style={styles.root}>
      <Txt variant="subheading" weight="700">
        Welche Module möchtest du nutzen?
      </Txt>
      <Txt variant="body" tone="secondary">
        Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
      </Txt>

      <View style={styles.list}>
        {SETTINGS_MODULES.map((row) => {
          // Gesperrt = das Modul wird gerade schrittweise ausgerollt und ist
          // fuer diesen Nutzer noch nicht freigeschaltet (#183) — Karte
          // bleibt sichtbar, Switch wird per grauer Ueberlagerung unbedienbar.
          const locked = isModuleLocked(row.featureFlag);

          return (
            <Press
              key={row.key}
              onPress={() => !locked && toggle(row.key)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={row.title}
              accessibilityState={{ disabled: locked, selected: state.modules[row.key] }}
              haptic="selection"
              style={[
                styles.moduleRow,
                state.modules[row.key] ? styles.moduleSelected : styles.moduleIdle,
              ]}>
              <View style={[styles.moduleCopy, locked && styles.lockedContent]}>
                <Txt variant="body" weight="700">
                  {row.icon} {row.title}
                </Txt>
                <Txt variant="label" tone="secondary" style={styles.moduleDescription}>
                  {row.desc}
                </Txt>
              </View>
              <View style={locked ? styles.lockedContent : undefined}>
                <Switch
                  value={state.modules[row.key]}
                  onValueChange={() => toggle(row.key)}
                  disabled={locked}
                />
              </View>
              {locked && <ModuleLockedOverlay />}
            </Press>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.flex}>
          <Button title="Weiter" onPress={onNext} />
        </View>
        <View style={styles.flex}>
          <Button title="Überspringen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
