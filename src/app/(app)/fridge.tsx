import { ModuleGate } from '@/components/module-gate';
import { InventoryScreen } from '@/features/inventory/inventory-screen';

export default function FridgeRoute() {
  return (
    <ModuleGate feature="fridge">
      <InventoryScreen />
    </ModuleGate>
  );
}
