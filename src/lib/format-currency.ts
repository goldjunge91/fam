export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}
