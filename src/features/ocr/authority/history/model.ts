export type ReceiptHistorySortValue = {
  id: string;
  purchase_date: string | null;
  created_at: string;
};

export function sortReceiptHistory<T extends ReceiptHistorySortValue>(receipts: readonly T[]): T[] {
  return [...receipts].sort((left, right) => {
    const purchaseDateOrder = (right.purchase_date ?? '').localeCompare(left.purchase_date ?? '');
    if (purchaseDateOrder !== 0) return purchaseDateOrder;

    const createdAtOrder = right.created_at.localeCompare(left.created_at);
    if (createdAtOrder !== 0) return createdAtOrder;

    return left.id.localeCompare(right.id);
  });
}
