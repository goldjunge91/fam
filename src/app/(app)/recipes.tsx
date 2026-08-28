import { ModuleGate } from '@/components/module-gate';
import { RecipesScreen } from '@/features/recipes/screens/recipes-screen';

export default function RecipesRoute() {
  return (
    <ModuleGate feature="recipes">
      <RecipesScreen />
    </ModuleGate>
  );
}
