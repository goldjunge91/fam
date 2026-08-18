import { ModuleGate } from '@/components/module-gate';
import { InventoryScreen } from '@/features/inventory/inventory-screen';

export default function FridgeRoute() {
  return (
    <ModuleGate module="fridge" title="Vorrat">
      <InventoryScreen />
    </ModuleGate>
  );
}
