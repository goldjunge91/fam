import { ModuleGate } from '@/components/module-gate';
import { MealPlannerScreen } from '@/features/meal-planner/meal-planner-screen';

export default function MealPlannerRoute() {
  return (
    <ModuleGate module="mealPlanner" title="Meal-Planner">
      <MealPlannerScreen />
    </ModuleGate>
  );
}
