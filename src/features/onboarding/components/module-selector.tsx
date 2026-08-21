import { Pressable, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { useOnboarding } from '../context/onboarding-context';

interface ModuleSelectorFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
  const { state, updateModulesData } = useOnboarding();

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
        <Pressable
          onPress={() => toggle('fridge')}
          className={`onboard-module-row ${state.modules.fridge ? 'module-row-selected' : 'module-row-idle'}`}>
          <View className="perm-text-col">
            <Text className="onboard-module-title">🧊 Kühlschrank & Vorrat</Text>
            <Text className="onboard-module-desc">
              Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.
            </Text>
          </View>
          <Switch value={state.modules.fridge} onValueChange={() => toggle('fridge')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('shoppingList')}
          className={`onboard-module-row ${state.modules.shoppingList ? 'module-row-selected' : 'module-row-idle'}`}>
          <View className="perm-text-col">
            <Text className="onboard-module-title">🛒 Geteilte Einkaufsliste</Text>
            <Text className="onboard-module-desc">
              Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.
            </Text>
          </View>
          <Switch value={state.modules.shoppingList} onValueChange={() => toggle('shoppingList')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('calories')}
          className={`onboard-module-row ${state.modules.calories ? 'module-row-selected' : 'module-row-idle'}`}>
          <View className="perm-text-col">
            <Text className="onboard-module-title">🍎 Kalorienzähler & Tagebuch</Text>
            <Text className="onboard-module-desc">
              Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.
            </Text>
          </View>
          <Switch value={state.modules.calories} onValueChange={() => toggle('calories')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('recipes')}
          className={`onboard-module-row ${state.modules.recipes ? 'module-row-selected' : 'module-row-idle'}`}>
          <View className="perm-text-col">
            <Text className="onboard-module-title">📖 Rezept-Manager</Text>
            <Text className="onboard-module-desc">
              Rezepte anlegen und Portionsmengen berechnen.
            </Text>
          </View>
          <Switch value={state.modules.recipes} onValueChange={() => toggle('recipes')} />
        </Pressable>

        <Pressable
          onPress={() => toggle('mealPlanner')}
          className={`onboard-module-row ${state.modules.mealPlanner ? 'module-row-selected' : 'module-row-idle'}`}>
          <View className="perm-text-col">
            <Text className="onboard-module-title">🗓️ Meal-Planner</Text>
            <Text className="onboard-module-desc">
              Die Woche vorausplanen und Mahlzeiten Mitgliedern zuordnen.
            </Text>
          </View>
          <Switch value={state.modules.mealPlanner} onValueChange={() => toggle('mealPlanner')} />
        </Pressable>
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
