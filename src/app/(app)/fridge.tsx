import { ModuleGate } from '@/components/module-gate';
import { FridgeScreen } from '@/features/fridge/fridge-screen';

export default function FridgeRoute() {
  return (
    <ModuleGate module="fridge" title="Vorrat">
      <FridgeScreen />
    </ModuleGate>
  );
}
