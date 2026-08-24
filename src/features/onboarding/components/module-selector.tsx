import { Pressable, Switch, Text, View } from 'react-native';
import { ModuleLockedOverlay } from '@/components/module-locked-overlay';
import { Button } from '@/components/ui/buttons';
import { getSettingsModules } from '@/constants/feature-registry';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useOnboarding } from '../context/onboarding-context';

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
      <Text className="perm-heading">Welche Module möchtest du nutzen?</Text>
      <Text className="perm-subheading">
        Du kannst ungenutzte Module jederzeit später in den Einstellungen anpassen.
      </Text>

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
