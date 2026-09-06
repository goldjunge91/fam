import { useRouter } from 'expo-router';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { AddItemModal } from '@/features/shopping-list/modals/add-item-modal';

export default function ShoppingListAddItemRoute() {
  const router = useRouter();
  const { activeHouseholdId } = useActiveHousehold();

  if (!activeHouseholdId) return null;

  return (
    <AddItemModal
      visible
      householdId={activeHouseholdId}
      onDismiss={() => router.replace('/(app)/shopping-list')}
    />
  );
}
