import { ModuleGate } from '@/components/module-gate';
import { GoalSetupScreen } from '@/features/calorie-tracking/goal-setup-screen';

export default function GoalsRoute() {
  return (
    <ModuleGate feature="calories">
      <GoalSetupScreen />
    </ModuleGate>
  );
}
