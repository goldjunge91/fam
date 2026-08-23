import { Slot } from 'expo-router';

import { ModuleGate } from '@/components/module-gate';

export default function RecipeLayout() {
  return (
    <ModuleGate module="recipes" featureFlag="module-recipes" title="Rezepte">
      <Slot />
    </ModuleGate>
  );
}
