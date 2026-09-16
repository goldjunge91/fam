# Spec: `shopping-list-integration`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `shopping-list-integration`

Dieses Modul ist die einzige Brücke der isolierten Beta in bestehende
Einkaufslistendaten. Es darf die vorhandene Schreibgrenze verwenden, aber
keine bestehenden Add-Item-Komponenten verändern.

## Objective

Bestätigte oder sicher automatisch freigegebene Vorschläge werden über den
bestehenden local-first Shopping-List-Pfad gespeichert.

## Contract

- Verwende ausschließlich die bestehende `useAddShoppingItem`-/Outbox-
  Schreibgrenze und deren etablierte Merge-Regeln.
- Jeder freigegebene Artikel wird einzeln mit seiner Menge, Einheit,
  `product_id`-Auflösung und `store_id` geschrieben.
- Bestehende Merge-Regeln bleiben unverändert.
- Unklare Artikel werden nicht an die Schreibmutation übergeben.
- Batch-Verarbeitung darf bei einem einzelnen Fehler keine bereits bestätigten
  Artikel unkontrolliert duplizieren.
- Offline-Schreiben und späterer Sync folgen dem vorhandenen Vertrag.
- Keine neue parallele Persistenz- oder Sync-Schicht.

## Success Criteria

- Bestätigte Batch-Artikel erscheinen lokal sofort auf der richtigen
  Händlerliste.
- Outbox-Einträge entsprechen den bestehenden Shopping-List-Mutationsverträgen.
- Wiederholte identische Artikel nutzen die vorhandene Merge-Logik.
- Fehler- und Retrypfade sind mit fokussierten Integrations-Tests abgesichert.
