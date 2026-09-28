/** Liest den einzelnen Einkaufsartikel aus dem Deep-Link der Siri-Aktion. */
export function parseSiriShoppingItemName(
  value: string | readonly string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
