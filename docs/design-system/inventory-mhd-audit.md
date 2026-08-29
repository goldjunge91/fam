# Design-Audit: Vorrat mit addierten Artikeln und sichtbaren MHDs

Stand: 2026-08-29  
Status: Vorschlag, nicht implementiert

## Ergebnis

Die empfohlene Struktur ist **eine sichtbare Artikelgruppe mit separat
einsehbaren MHD-Losen**.

```text
Milch 1,5 %                         4 l  ›
2 MHD · nächstes: 03.09.2026

Nach Tap:
  2 l · 03.09.2026 · Kühlschrank
  2 l · 12.09.2026 · Kühlschrank
```

Damit bekommt der Nutzer beides:

- eine ruhige Liste ohne fünfmal denselben Artikel,
- vollständige MHD-Transparenz ohne Datenverlust.

Das statische Mockup liegt unter
[`docs/mockups/vorrat-mhd/vorrat-mhd-mockup.html`](../mockups/vorrat-mhd/vorrat-mhd-mockup.html).

## Was ich im bestehenden Vorrat gefunden habe

Geprüft wurden `inventory-screen.tsx`, `use-inventory-items.ts`,
`visible-items.ts`, `inventory-item-row.tsx`, die Aktions- und Edit-Sheets,
der Add-Flow sowie das lokale SQLite-Schema.

1. `fridge_items` wird aktuell eins zu eins als sichtbare Zeile gerendert.
2. Beim Hinzufügen und beim Übertrag aus der Einkaufsliste wird immer ein neuer
   Datensatz angelegt. Gleiche Produkte werden nicht zusammengeführt.
3. `expiry_date` ist bereits pro Datensatz vorhanden. Das ist die richtige
   Grundlage für einzelne MHD-Lose.
4. Die aktuelle Zusammenfassung zählt Datensätze, nicht addierte Mengen.
5. Aktionen wie Bearbeiten, Verbraucht und Entfernen beziehen sich auf genau
   eine Zeile. Nach einer Anzeige-Aggregation müssen sie auf ein konkretes Los
   oder eine eindeutige Verbrauchsregel zeigen.

## Empfohlenes Modell

### 1. Artikelgruppe

Die Gruppe ist eine reine Anzeigeeinheit. Sie besitzt keine eigene Menge und
kein eigenes MHD.

Gruppierung in absteigender Verlässlichkeit:

1. `product_id`, wenn vorhanden.
2. Für manuelle Einträge: normalisierter Name plus Einheit,
   Packungsgröße und Packungsgrößeneinheit.

Der Lagerort ist im Filterkontext: In einem konkreten Lagerort wird nur dieser
Bestand gruppiert. Unter `Alle` wird derselbe Artikel über Lagerorte addiert,
mit einer Lagerort-Aufteilung im Detail.

### 2. MHD-Los

Jeder bestehende `fridge_items`-Datensatz bleibt ein eigenständiges Los mit:

- eigener Menge,
- eigenem `expiry_date`, auch wenn es `null` ist,
- eigenem Lagerort,
- eigener ID für Bearbeiten, Verbrauch und Synchronisation.

Ein Los darf niemals beim Gruppieren überschrieben oder mit einem anderen MHD
verschmolzen werden.

### 3. Verbrauch

Die Standardaktion **Verbrauchen** arbeitet nach FEFO: zuerst das Los mit dem
frühesten MHD, danach das nächste. Bei Teilverbrauch bleibt das MHD am Rest
des Loses erhalten. Das macht die Aktion schnell, ohne die Nachvollziehbarkeit
zu verlieren.

## Empfohlene Nutzerführung

### Hauptliste

Eine Zeile pro Artikelgruppe:

- Name des Artikels
- addierte Menge und Einheit rechts
- `n MHD` als Anzahl der Lose
- nächstes MHD als primäre Statusinformation
- bei `Alle`: kurze Lagerort-Zusammenfassung nur dann, wenn sie relevant ist

Der farbige MHD-Streifen bleibt erhalten, steht aber für das dringendste Los.
Der Status wird zusätzlich als Text ausgegeben, damit Farbe nicht allein die
Bedeutung trägt.

### Detail-Sheet

Tap auf eine Gruppe öffnet ein Sheet:

- `Milch 1,5 %`
- `4 l gesamt · 2 MHD-Einträge`
- sortierte Liste aller Lose mit Menge, exaktem MHD und Lagerort
- Aktion pro Los: `Ändern`
- primäre Gruppenaktion: `Verbrauchen`
- sekundäre Aktion: `MHD hinzufügen`

`Bearbeiten` darf nach der Gruppierung nicht stillschweigend ein beliebiges
Los ändern. Es muss entweder direkt am Los angeboten werden oder zuerst die
Los-Auswahl öffnen.

### Hinzufügen

Beim Hinzufügen eines bereits vorhandenen Artikels wird ein neues Los angelegt,
wenn das MHD abweicht. Die UI darf den Nutzer dabei nicht mit einer zweiten
Warnung blockieren. Eine knappe Bestätigung wie `Milch zu 2 MHD-Einträgen
ergänzt` reicht als Orientierung.

### Ablauf-Filter und Zusammenfassung

- Ein Artikel erscheint im Ablauf-Filter einmal, wenn mindestens ein Los
  abgelaufen oder kritisch ist.
- Das Detail zeigt dann genau, welches Los betroffen ist.
- Die Zusammenfassung sollte zwischen `Artikelgruppen`, `Einheiten` und
  `MHD bald` unterscheiden. Die bisherige Datensatzanzahl ist dafür nicht
  aussagekräftig.

## Audit der aktuellen Oberfläche

| Dimension | Bewertung | Befund |
| --- | --- | --- |
| Visuelle Hierarchie | Needs Work | Zeilen, MHD-Status und Mengensteuerung konkurrieren; gleiche Artikel zerfasern die Liste. |
| Spacing & Rhythmus | Pass | Die Zeilen folgen einem erkennbaren Rhythmus; viele Duplikate machen ihn trotzdem lang. |
| Typografie | Pass | Name, MHD-Metadaten und Menge sind grundsätzlich gut getrennt. |
| Farbe | Needs Work | Der Streifen ist hilfreich, darf bei aggregierten Gruppen aber nicht den Status eines einzelnen Loses verschleiern. |
| Alignment & Grid | Pass | Menge rechts und Inhalt links bilden ein stabiles Raster. |
| Komponenten | Needs Work | Die Zeile ist auf ein einzelnes Los ausgelegt; Sheet und Edit-Flow kennen keine Gruppe. |
| Iconography | Needs Work | Die Interaktion mit mehreren MHDs braucht ein eindeutiges Disclosure-Signal. |
| Motion & Transitions | Needs Work | Für Auf- und Zuklappen beziehungsweise Sheet-Wechsel fehlt ein abgestimmtes Gruppenmodell. |
| Empty States | Pass | Der bestehende Leerzustand ist verständlich und handlungsorientiert. |
| Loading States | Needs Work | Der Listenkopf hat keinen gruppierten Layout-Zustand, der den finalen Rhythmus vorwegnimmt. |
| Error States | Needs Work | Aktionen auf einem konkreten Los brauchen bei Aggregation eine klare Fehlerzuordnung. |
| Dark Mode / Theming | Pass | Die vorhandenen Theme-Tokens sind für Gruppe, Los und Status ausreichend. |
| Density | Needs Work | Mehrere Zeilen je Artikel erhöhen die kognitive und vertikale Dichte unnötig. |
| Responsiveness | Pass | Das aktuelle mobile Raster ist grundsätzlich geeignet; ein Sheet ist für viele Lose robuster als eine breite Tabelle. |
| Accessibility | Needs Work | Gruppenmenge, MHD-Anzahl, nächstes MHD und die konkrete Los-Auswahl müssen gemeinsam angekündigt werden. |

## Jobs-Filter

| Element | Kill-Signale | Elevate-Signale | Entscheidung |
| --- | ---: | ---: | --- |
| Doppelte Hauptzeilen je Produkt | 4 | 3 | Redesign: zu einer Artikelgruppe zusammenfassen. |
| MHD als separates Los | 1 | 5 | Elevate: exaktes Datum, Menge und Lagerort im Detail sichtbar machen. |
| Nächstes MHD in der Gruppenzeile | 1 | 5 | Elevate: dient direkt der Verbrauchsentscheidung. |
| Detail-Sheet | 1 | 4 | Elevate: erhält Transparenz ohne die Hauptliste zu überladen. |
| Zweite gleichrangige Primäraktion | 3 | 1 | Entfernen: `Verbrauchen` primär, `MHD hinzufügen` sekundär. |

## Phasenplan

### Phase 1: Kritisch

- Reine Gruppierungsfunktion für die Anzeige definieren und separat testen.
- Eine Artikelgruppe pro Produktidentität rendern.
- Gruppenzeile mit Gesamtmenge, MHD-Anzahl und nächstem MHD.
- Detail-Sheet mit allen Losen, exaktem Datum und Lagerort.
- Verbrauch nach frühestem MHD eindeutig machen.
- Ablauf-Filter und Zusammenfassung auf Gruppen-/Los-Semantik umstellen.

### Phase 2: Verfeinerung

- Editieren immer auf Los-Ebene führen.
- Lagerort-Aufteilung nur in `Alle` anzeigen.
- Hinzufügen eines gleichen Artikels ruhig bestätigen, nicht blockieren.
- Einheit, Packungsgröße und manuelle Namensnormalisierung als sichtbare
  Identitätsregeln dokumentieren.

### Phase 3: Politur

- Zugängliche Ansage für Gruppe und Losbestand.
- Reduce-Motion-Verhalten für Inline-Aufklappen oder Sheet-Animation.
- Skeleton-Zeilen mit gruppierter Endbreite.
- Leerer Zustand für eine Gruppe ohne MHD: `ohne MHD`, eindeutig getrennt von
  ablaufenden Losen.

## Offene Produktentscheidung vor der Implementierung

Dieser Audit behandelt die **aktuell vorhandenen** Lose als einsehbar. Bitte
noch entscheiden:

> Soll ein vollständig verbrauchtes oder entsorgtes MHD später weiterhin in
> einer Historie einsehbar sein?

Wenn ja, reicht die aktuelle sichtbare Bestandsstruktur allein nicht aus. Dann
brauchen wir zusätzlich ein unveränderliches Verbrauchs-/Entsorgungsprotokoll.
Wenn nein, bleiben die MHDs solange sichtbar, wie das jeweilige Los Bestand
hat, und der bestehende Lösch-/Sync-Pfad kann konzeptionell erhalten bleiben.

## Freigabepunkt

Es wurden keine echten Komponenten, Datenbankschemas oder Mutationen geändert.
Die empfohlene nächste Umsetzung ist Phase 1 mit Variante A aus dem Mockup.

