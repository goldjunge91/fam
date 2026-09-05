# fam AI-Konzept-Mockups

Statische, interaktive Konzeptansichten für ein mögliches AI-Tool in fam.

Die UI-Platzierungsstudie liegt in `ai-ui-placement-mockup.html`. Sie fokussiert ausschließlich den fam-Kreis und vergleicht Dashboard-only, global schwebend und kontextbezogen jeweils im geschlossenen und geöffneten Zustand.

Die Referenzscreen-Version liegt in `ai-ui-exact-app-mockup.html`. Sie verwendet die vorhandenen Screenshots aus `docs/screenshots` als unveränderte App-Grundfläche und legt nur den neuen fam-Kreis sowie das geöffnete Sheet darüber.

Die aktuelle Speed-Dial-Version liegt in `ai-speed-dial-mockup.html`. Sie zeigt Dashboard → bestehendes Plus-Menü → fam als Schnellaktion → fam-Sheet.

Der erste Tab zeigt den vollständigen geführten Flow ab Dashboard:

`Dashboard → Kontext bestätigen → Vorschlag → Rezept prüfen → Einkauf bestätigen → Essensplan aktualisiert`

## Enthaltene Richtungen

1. **Küchenlotse** – situationsbezogener Rezeptvorschlag aus geprüftem Vorrat.
2. **Wochenplaner** – AI erstellt einen editierbaren Essensplan mit sichtbaren Einschränkungen.
3. **Frag fam** – natürlicher Zugang zu geteilten Haushaltsdaten mit klarer Quellen- und Privatsphäre-Anzeige.

## Leitplanken aus dem bestehenden Produktkontext

- AI liest nur den für die konkrete Anfrage geprüften Kontext.
- Private Tracking-Daten bleiben vom Haushaltsassistenten getrennt.
- Keine Bestands- oder Einkaufslistenänderung ohne explizite Bestätigung.
- Vorhandene Rezepte werden vor einem generativen Fallback bevorzugt.

Die Ansicht ist bewusst ein Diskussionsartefakt und keine Implementierung.
