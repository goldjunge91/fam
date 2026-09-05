import { Pressable, Switch, View } from 'react-native';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { Button } from '@/components/ui/buttons';
import { getSettingsModules } from '@/constants/feature-registry';
import { Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useOnboarding } from '../onboarding-store';

interface ModuleSelectorFormProps {
  onNext: () => void;
  onSkip: () => void;
}

const SETTINGS_MODULES = getSettingsModules();

export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
  const { state, updateModulesData } = useOnboarding();
  const { isModuleLocked } = useFeatureAccess();

  const toggle = (key: keyof typeof state.modules) => {
    updateModulesData({ [key]: !state.modules[key] });
  };

  return (
    <View className="gap-three">
      <Txt variant="subheading" weight="700">
        Welche Module möchtest du nutzen?
      </Txt>
      <Txt variant="body" tone="secondary">
        Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
      </Txt>

      <View className="perm-list">
        {SETTINGS_MODULES.map((row) => {
          // Gesperrt = das Modul wird gerade schrittweise ausgerollt und ist
          // fuer diesen Nutzer noch nicht freigeschaltet (#183) — Karte
          // bleibt sichtbar, Switch wird per grauer Ueberlagerung unbedienbar.
          const locked = isModuleLocked(row.featureFlag);

          return (
            <Pressable
              key={row.key}
              onPress={() => !locked && toggle(row.key)}
              disabled={locked}
              className={`onboard-module-row ${state.modules[row.key] ? 'module-row-selected' : 'module-row-idle'}`}>
              <View className={`perm-text-col ${locked ? 'module-row-locked-content' : ''}`}>
                <Txt variant="body" weight="700">
                  {row.icon} {row.title}
                </Txt>
                <Txt variant="label" tone="secondary" className="mt-half">
                  {row.desc}
                </Txt>
              </View>
              <View className={locked ? 'module-row-locked-content' : undefined}>
                <Switch
                  value={state.modules[row.key]}
                  onValueChange={() => toggle(row.key)}
                  disabled={locked}
                />
              </View>
              {locked && <ModuleLockedOverlay />}
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
