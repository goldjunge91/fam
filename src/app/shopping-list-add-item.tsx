import { useLocalSearchParams, useRouter } from 'expo-router';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { AddItemModal } from '@/features/shopping-list/modals/add-item-modal';
import { ShoppingListSiriRequestHandler } from '@/features/shopping-list/siri/shopping-list-siri-request-handler';

export default function ShoppingListAddItemRoute() {
  const router = useRouter();
  const { activeHouseholdId } = useActiveHousehold();
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const siriRequest = params.name !== undefined;

  if (siriRequest) return <ShoppingListSiriRequestHandler itemParam={params.name} />;
  if (!activeHouseholdId) return null;

  return (
    <AddItemModal
      visible
      householdId={activeHouseholdId}
      onDismiss={() => router.replace('/(app)/shopping-list')}
    />
  );
}
