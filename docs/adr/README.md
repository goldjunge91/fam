# Architecture Decision Records

Diese ADRs halten dauerhafte Architektur- und Domänenentscheidungen fest. Sie
dokumentieren den Kontext, die Entscheidung, wichtige Alternativen und die
Folgen. Die laufende Implementierung steht weiterhin im Code, im deklarativen
Schema und in den Tests.

## Entscheidungen

| ADR | Entscheidung | Status |
| --- | --- | --- |
| [0001](0001-recursive-recipe-components.md) | Rezepte verwenden rekursive Components statt einer flachen Zutatenliste. | Akzeptiert |
| [0002](0002-recipe-templates-separate-table-family.md) | Rezeptvorlagen leben in einer getrennten Tabellenfamilie. | Akzeptiert |
| [0003](0003-deterministic-preference-identity.md) | Einkaufspräferenzen erhalten deterministische UUIDv5-IDs. | Akzeptiert |
| [0004](0004-exclusive-tracking-method.md) | Die Tracking-Methode bleibt eine exklusive Single-Choice. | Akzeptiert |
| [0005](0005-kind-tracking-gehoert-dem-kindprofil.md) | Kind-Tracking gehört fachlich zum Kindprofil; der Umbau ist bis zu einem konkreten Auslöser eingefroren. | Akzeptiert, Umbau eingefroren |
| [0006](0006-nativewind-als-auslaufende-layout-hilfe.md) | NativeWind wird nicht weiter ausgebaut und nach der Verbrauchermigration entfernt. | Akzeptiert, schrittweise Migration |

## Lebenszyklus

`PROPOSED → ACCEPTED → SUPERSEDED oder DEPRECATED`

ADRs werden nicht gelöscht. Wenn sich eine Entscheidung ändert, kommt ein neues
ADR hinzu, das die bisherige Entscheidung ausdrücklich ablöst. Die Nummerierung
bleibt fortlaufend und die bestehenden Dateinamen werden nicht nachträglich
umbenannt.

## Wann ein ADR nötig ist

Ein ADR ist sinnvoll bei Entscheidungen, die teuer zu ändern sind oder später
erneut diskutiert werden könnten, zum Beispiel:

- Datenmodell, Eigentümerschaft oder RLS-Architektur
- Frameworks, native Abhängigkeiten oder Build-/Hosting-Strategien
- Authentifizierungs-, Sync- oder API-Architektur
- bewusst verworfene Produkt- oder Integrationsalternativen mit technischen Folgen

Kleine Implementierungsdetails gehören in den Code, gezielte Tests oder die
jeweilige Feature-Spezifikation. Die [Dokumentationslandkarte](../README.md)
zeigt, wo die anderen Dokumenttypen liegen.
