import { ModuleGate } from '@/components/module-gate';
import { MealPlannerScreenV2 } from '@/features/meal-planner/meal-planner-screen-v2';

export default function MealPlannerV2Route() {
  return (
    <ModuleGate module="mealPlanner" title="Meal-Planner V2">
      <MealPlannerScreenV2 />
    </ModuleGate>
  );
}
