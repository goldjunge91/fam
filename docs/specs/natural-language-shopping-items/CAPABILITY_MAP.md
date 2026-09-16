# Capability Map: Natürliche Eingabe von Einkaufsartikeln

**Status:** Freigegeben für Modul-Specs
**Version:** 0.1
**Stand:** 2026-09-16
**Bead:** `fam-pa0g`

## Ziel

Die Einkaufsliste erhält einen schnellen, local-first Eingabepfad für mehrere
Artikel in natürlicher Sprache. Getippter Text und Speech-to-Text liefern dabei
denselben Parser-Eingang. Die lokale Erkennung bleibt immer der erste Schritt.
Optionale KI verbessert nur auf ausdrückliche Einwilligung und niemals mit
direkter Schreibberechtigung auf die Einkaufsliste.

## Beta-Isolation

Die gesamte Funktion wird als isolierte Beta implementiert. Der bestehende
manuelle Add-Item-Flow bleibt unverändert. Die Beta erhält einen eigenen
Feature-Root und einen eigenen Einstieg. Als gemeinsame Grenze ist nur die
bestehende `useAddShoppingItem`-/Outbox-Mutation erlaubt.

Insbesondere werden `AddItemForm`, `AddItemModal` und
`ShoppingListScreen` nicht erweitert oder umgebaut. Die konkrete Beta-Route
und ihr Rollout-Gate werden im Plan festgelegt.

## Bestätigte Leitplanken

1. Die erste Version unterstützt getippte Eingabe und Speech-to-Text.
2. Speech-to-Text muss offline funktionieren. Die native Geräte-/Betriebs-
   systemerkennung darf dennoch verwendet werden, auch wenn sie auf einzelnen
   Geräten eine Onlineverbindung nutzt.
3. Nach ungefähr zehn erfolgreichen Lernsignalen fragt die App einmalig, ob
   eindeutige lokale Ergebnisse automatisch verarbeitet werden dürfen. Der
   MVP-Schwellenwert ist die Variable `10`.
4. Ein Lernsignal ist eine bestätigte oder korrigierte eindeutige
   Artikelzuordnung. Identische Wiederholungen zählen nicht erneut.
5. Automatische lokale Verarbeitung und KI-Nutzung sind getrennte
   Zustimmungen.
6. Ein aktives AI-Abo und eine ausdrückliche KI-Einwilligung sind beide nötig,
   bevor ein KI-Dienst aufgerufen wird.
7. Die drei KI-Stufen sind `leicht`, `mittel` und `voll`.
8. Explizite Händlerangaben haben Vorrang vor Markenmappings. `Skyr von ja`
   wird als REWE-Eigenmarke erkannt und auf die REWE-Liste geroutet.
9. Unbekannte oder widersprüchliche Artikel- und Händlerzuordnungen werden
   markiert und vor dem Speichern bestätigt.
10. Anonymisierte Trainingsdaten sind eine spätere Option und kein Bestandteil
    der ersten Version.

## Capability Map

| Modul-ID | Verantwortung | Abhängigkeiten |
|---|---|---|
| `speech-input` | Offline-fähige Speech-to-Text-Aufnahme, native Geräteerkennung, Berechtigungen, Start/Stop und Fehler-/Nichtverfügbarkeits-Fallback | — |
| `local-recognition` | Getippten oder transkribierten deutschen Text in einzelne Artikel mit Menge, Einheit, Produkt und Marke zerlegen | `speech-input` als optionaler Eingang |
| `retailer-routing` | Explizite Händlerangaben und Markenmappings auflösen; sichere, unklare und widersprüchliche Fälle unterscheiden | `local-recognition` |
| `review-and-automation` | Vorschau, Bearbeitung, Bestätigung, Lernzähler und getrennte lokale Automatisierungszustimmung | `local-recognition`, `retailer-routing` |
| `ai-assist` | Optionaler KI-Fallback mit Abo-/Einwilligungsprüfung und den Stufen leicht, mittel, voll; liefert nur Verbesserungsvorschläge | `local-recognition`, `retailer-routing` |
| `shopping-list-integration` | Sichere Ergebnisse ausschließlich über die bestehende Shopping-List- und Outbox-Mutation schreiben | `review-and-automation`, `ai-assist` |

## Build-Reihenfolge

```text
speech-input ─────────────┐
                          ├─> local-recognition -> retailer-routing
                          │                         |
                          │                         v
                          │                review-and-automation
                          │                    |             |
                          │                    |             v
                          │                    └──────> ai-assist
                          │                                  |
                          └──────────────────────────────────┴─> shopping-list-integration
```

`shopping-list-integration` verwendet die bestehende Shopping-List-Mutation
und die lokale Outbox. Es entsteht keine parallele Schreiblogik.

## Gemeinsame Grenze

Alle Module liefern strukturierte Ergebnisse mit explizitem Status. Ein
unsicheres Ergebnis ist nicht dasselbe wie ein fehlendes Ergebnis und darf
nicht stillschweigend als sicher behandelt werden. Nur das Review-/Automation-
Modul entscheidet, ob ein Ergebnis bestätigt, erneut geprüft oder automatisch
zur Integration freigegeben wird.
