/** Formatiert einen Euro-Betrag im deutschen Format, z.B. `24,80 €`. */
export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}
