import { ModuleGate } from '@/components/module-gate';
import { DiaryScreen } from '@/features/calorie-tracking/diary-screen';

export default function DiaryRoute() {
  return (
    <ModuleGate feature="calories">
      <DiaryScreen />
    </ModuleGate>
  );
}
