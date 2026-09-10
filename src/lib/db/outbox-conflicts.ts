export type InventoryConflictCorrection = {
  expected_quantity: number;
  new_quantity: number;
};

export type FridgeItemConflict = {
  itemId: string;
  operationId: string;
  lastError: string;
  correction: InventoryConflictCorrection | null;
};
