import type { Store } from '../hooks/use-stores';

type Props = {
  isOpen: boolean;
  store: Store | null;
  onClose: () => void;
};

/** The category-order sheet is intentionally native-only. */
export function CategoryOrderSheet(_props: Props): null {
  return null;
}
