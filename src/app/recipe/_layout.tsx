import { Slot } from 'expo-router';

import { ModuleGate } from '@/components/module-gate';

export default function RecipeLayout() {
  return (
    <ModuleGate feature="recipes">
      <Slot />
    </ModuleGate>
  );
}
