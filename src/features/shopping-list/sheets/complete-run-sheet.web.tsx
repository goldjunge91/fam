import type { StorageKind } from '../domain-logik/shopping-categories';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';

export type { StorageKind };

export type TransferItem = {
  shoppingItemId: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  packageSize: number | null;
  packageSizeUnit: string | null;
  locationKind: StorageKind;
  expiryDate: string | null;
};

type Props = {
  isOpen: boolean;
  checkedItems: LocalShoppingItem[];
  onConfirm: (transfers: TransferItem[]) => void;
  onClose: () => void;
};

/** The complete-run sheet is intentionally native-only. */
export function CompleteRunSheet(_props: Props): null {
  return null;
}
