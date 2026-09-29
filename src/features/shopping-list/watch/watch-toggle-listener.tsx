import { useEffect } from 'react';
import { debugError } from '@/lib/observability/debug-log';
import watchConnectivity from '../../../../modules/fam-watch-connectivity';
import { useToggleShoppingItem } from '../hooks/use-shopping-list-mutations';
import { toWatchShoppingToggleMutationInput } from './watch-toggle-handler';

export function WatchShoppingToggleListener({
  activeHouseholdId,
  accountId,
}: {
  activeHouseholdId: string | null;
  accountId: string | null;
}) {
  const { mutateAsync } = useToggleShoppingItem();

  useEffect(() => {
    const subscription = watchConnectivity.addWatchToggleListener((event) => {
      const input = toWatchShoppingToggleMutationInput(
        event,
        activeHouseholdId,
        accountId,
        new Date().toISOString(),
      );
      if (!input) return;

      void mutateAsync(input).catch((error: unknown) => {
        debugError('Watch-Einkaufslistenänderung fehlgeschlagen:', error);
      });
    });

    return () => {
      subscription?.remove();
    };
  }, [accountId, activeHouseholdId, mutateAsync]);

  return null;
}
