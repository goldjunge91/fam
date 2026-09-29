import type { WatchShoppingToggleEvent } from '../../../../modules/fam-watch-connectivity';

export type WatchShoppingToggleMutationInput = {
  id: string;
  household_id: string;
  checked_at: string | null;
  checked_by: string | null;
};

export function toWatchShoppingToggleMutationInput(
  event: WatchShoppingToggleEvent,
  activeHouseholdId: string | null,
  accountId: string | null,
  checkedAt: string,
): WatchShoppingToggleMutationInput | null {
  if (!event.itemId || event.householdId !== activeHouseholdId) return null;

  return {
    id: event.itemId,
    household_id: event.householdId,
    checked_at: event.isChecked ? checkedAt : null,
    checked_by: event.isChecked ? accountId : null,
  };
}
