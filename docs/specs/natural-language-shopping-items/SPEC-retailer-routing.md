# Spec: `retailer-routing`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `retailer-routing`

## Objective

Strukturierte Artikel werden sicher einer vorhandenen Händlerliste zugeordnet,
ohne unbekannte oder widersprüchliche Ergebnisse automatisch zu speichern.

## Contract

- Explizite Händlerangaben haben höchste Priorität.
- Eindeutige Markenmappings werden nur verwendet, wenn kein expliziter
  Händlerkonflikt besteht.
- `ja!`/`ja` wird als REWE-Eigenmarke erkannt, wenn der lokale Mappingbestand
  diese Zuordnung enthält.
- Keine globale Händlerdatenbank wird vorausgesetzt.
- Kein Mapping führt zu `store_id: null` plus Reviewstatus, nicht zu einer
  geratenen Liste.
- Routing ist eine reine Funktion und kennt nur übergebene Stores/Mappings.

## Success Criteria

- `Skyr von ja` wird bei vorhandenem REWE-Store nach REWE geroutet.
- `Skyr von ja für Aldi` wird nach Aldi geroutet, wenn Aldi ausdrücklich als
  Ziel genannt wird.
- Unbekannte Marken und widersprüchliche Händlerangaben landen in Review.
- Die Prioritätsregeln sind in fokussierten Unit-Tests abgedeckt.
