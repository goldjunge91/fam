import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

/**
 * Gemeinsame Einkaufsliste (Phase 2).
 *
 * Der Preisvergleich zwischen Ketten ist bewusst nicht Teil des ersten Wurfs:
 * REWE und EDEKA bieten keine oeffentliche API, und Scraping verstoesst gegen
 * ihre Nutzungsbedingungen. Geplant ist stattdessen ein PriceProvider-Interface
 * mit manueller Preiserfassung.
 */
export function ShoppingListScreen() {
  return (
    <Screen title="Einkauf" subtitle="Gemeinsame Liste">
      <Card>
        <EmptyState
          symbol="cart"
          title="Einkaufsliste ist leer"
          hint="Artikel, die zur Neige gehen, landen später automatisch hier. Bis dahin kannst du sie selbst hinzufügen."
        />
      </Card>
    </Screen>
  );
}
