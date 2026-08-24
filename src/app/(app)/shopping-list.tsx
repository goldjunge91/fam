import { ModuleGate } from '@/components/module-gate';
import { ShoppingListScreen } from '@/features/shopping-list/screens/shopping-list-screen';

export default function ShoppingListRoute() {
  return (
    <ModuleGate feature="shoppingList">
      <ShoppingListScreen />
    </ModuleGate>
  );
}
