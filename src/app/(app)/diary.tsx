import { ModuleGate } from '@/components/module-gate';
import { DiaryScreen } from '@/features/calorie-tracking/diary-screen';

export default function DiaryRoute() {
  return (
    <ModuleGate module="calories" featureFlag="module-calories" title="Tagebuch">
      <DiaryScreen />
    </ModuleGate>
  );
}
