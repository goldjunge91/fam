import { ModuleGate } from '@/components/module-gate';
import { ShoppingListScreen } from '@/features/shopping-list/shopping-list-screen';

export default function ShoppingListRoute() {
  return (
    <ModuleGate module="shoppingList" title="Einkauf">
      <ShoppingListScreen />
    </ModuleGate>
  );
}
