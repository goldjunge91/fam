import { ModuleGate } from '@/components/module-gate';
import { RecipesScreen } from '@/features/recipes/recipes-screen';

export default function RecipesRoute() {
  return (
    <ModuleGate feature="recipes">
      <RecipesScreen />
    </ModuleGate>
  );
}
