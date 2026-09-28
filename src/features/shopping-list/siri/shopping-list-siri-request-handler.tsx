import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholds } from '@/features/household/api';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { parseSiriShoppingItemName } from './shopping-list-siri-add-item';

type ShoppingListSiriRequestHandlerProps = {
  itemParam: string | string[] | undefined;
};

export function ShoppingListSiriRequestHandler({ itemParam }: ShoppingListSiriRequestHandlerProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { isLoading: sessionLoading, session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const households = useHouseholds();
  const addShoppingItem = useAddShoppingItem();
  const itemName = parseSiriShoppingItemName(itemParam);
  const handledSiriRequest = useRef(false);

  useEffect(() => {
    if (handledSiriRequest.current || sessionLoading || households.isLoading) {
      return;
    }

    handledSiriRequest.current = true;

    const returnToShoppingList = () => router.replace('/(app)/shopping-list');

    if (!itemName) {
      Alert.alert(
        t('shoppingList.siriAdd.invalidItemTitle'),
        t('shoppingList.siriAdd.invalidItemBody'),
        [{ text: t('common.done'), onPress: returnToShoppingList }],
      );
      return;
    }

    if (!session?.user.id || households.isError || !activeHouseholdId) {
      Alert.alert(
        t('shoppingList.siriAdd.noHouseholdTitle'),
        t('shoppingList.siriAdd.noHouseholdBody'),
        [{ text: t('common.done'), onPress: returnToShoppingList }],
      );
      return;
    }

    void addShoppingItem
      .mutateAsync({
        household_id: activeHouseholdId,
        name: itemName,
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        category_id: null,
        category_source: null,
        category_classifier_version: null,
        store_id: null,
        price_estimate: null,
      })
      .then(returnToShoppingList)
      .catch(() => {
        Alert.alert(
          t('shoppingList.siriAdd.saveErrorTitle'),
          t('shoppingList.siriAdd.saveErrorBody'),
          [{ text: t('common.done'), onPress: returnToShoppingList }],
        );
      });
  }, [
    activeHouseholdId,
    addShoppingItem,
    households.isError,
    households.isLoading,
    itemName,
    router,
    session?.user.id,
    sessionLoading,
    t,
  ]);

  return null;
}
