import { ModuleGate } from '@/components/module-gate';
import { TrackingScreen } from '@/features/profile/tracking-screen';

export default function TrackingPage() {
  return (
    <ModuleGate feature="calories">
      <TrackingScreen />
    </ModuleGate>
  );
}
