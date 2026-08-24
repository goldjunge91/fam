# Alpha: Einkaufsbereiche – UX- und App-Spec

Status: Umsetzungsgrundlage
Version: 4.0
Stand: 2026-08-24

Diese Spec beschreibt sichtbare App und App-Domäne. Datenbank, SQLite, Outbox
und Evaluation stehen in `ALPHA_BACKEND_KATEGORIEN_SPEC.md`. Die 27 Bereiche
stehen in `ALPHA_KATEGORIEN_ZONEN.md`.

## Ziel

Im bestehenden Add-/Edit-Formular wird „Kategorie“ zu „Einkaufsbereich“.
Nutzer können „Automatisch“ oder einen der 27 Bereiche auswählen. Die Auswahl
wird erst mit „Speichern“ wirksam.

Unverändert bleiben: Tippen öffnet Edit, Long Press löscht, der Einkaufsmodus
hat keine Bearbeitung. Es gibt keinen Schnell-Picker, keinen Hinweis, kein
Undo und keinen sichtbaren Sync- oder Lernstatus.

## Verbindliche Regeln

1. Die Taxonomie heißt `placement-taxonomy-v2`; IDs bleiben stabil.
2. `PlacementZoneId` ist die fachliche ID. Das DB-Feld bleibt `category_id`.
3. Eine Korrektur ändert nur die Placement Zone, nicht Produktfamilie oder
   Produktform.
4. Mit Markt gilt `stores.category_order`; ohne Markt die Standardreihenfolge
   aus `ALPHA_KATEGORIEN_ZONEN.md`. Alte oder doppelte IDs werden beim Lesen
   normalisiert, fehlende V2-Zonen angehängt.
5. Effektive Auflösung:

   ```text
   globale Klassifikation -> Haushaltspräferenz -> Store-Präferenz -> Snapshot
   ```

6. Neue Schreibvorgänge verwenden nur V2-IDs. Legacy-Normalisierung erzeugt
   kein Feedback-Event.

## Kanonische Quelle

Neu anzulegen:

```text
src/features/shopping-list/classification/placement-taxonomy.ts
```

Die React-freie Datei exportiert Zonen, Version, Farben, Ränge, Lagerorte,
Legacy-Mapping sowie ProductFamily/ProductForm-Typen. Klassifikator,
Gruppierung, Formular und Category Lab importieren daraus. Es gibt keine zweite
Zonenliste in `tools/category-debugger/src/evaluation/taxonomy.ts`.

## Formular

Betroffen sind insbesondere:

```text
src/features/shopping-list/forms/category-field.tsx
src/features/shopping-list/forms/add-item-form.tsx
src/features/shopping-list/forms/edit-item-form.tsx
src/features/shopping-list/preferences/*
```

`CategoryField` wird fachlich zu `PlacementZoneField`; der bestehende
Auswahlmechanismus wird wiederverwendet. Die Auswahl enthält „Automatisch“ und
alle 27 Zonen in der gültigen Reihenfolge.

Der Zustand lautet:

```ts
{ mode: 'automatic' }
{ mode: 'manual', zoneId: PlacementZoneId }
```

Zusätzlich wird `placementSelectionTouched` geführt. Add startet automatisch
und unangetastet. Edit zeigt den effektiven Wert, gilt aber ohne bewusste
Auswahl nicht als Nutzerkorrektur. „Automatisch“ zeigt die Zone nach Entfernen
der aktuellen Präferenz. Eine Auswahl ändert zunächst nur den Formularzustand.

## Speichern

- Mit Markt wird die Präferenz im Store-Scope gespeichert, ohne Markt im
  Haushalts-Scope.
- „Automatisch“ entfernt nur die Präferenz des aktuellen Scopes und löst neu
  auf.
- Ein Marktwechsel übernimmt keine Präferenz des alten Markts.
- Eine manuelle Auswahl im selben Speichervorgang gilt für den neuen Markt.
- Artikel, Präferenz und optionales Event werden lokal atomar gespeichert.
- Abbrechen erzeugt keine Änderung und kein Event.
- Netzwerkfehler blockieren das lokale Speichern nicht und werden im
  Einkaufsablauf nicht zusätzlich angezeigt.

## Feedback

Feedback wird nur bei aktivem Alpha-Flag gesammelt und bleibt für Nutzer
unsichtbar. Ein `manual_reassign`-Event entsteht nur bei bewusster Auswahl,
Abweichung von der globalen Vorhersage und tatsächlicher Änderung im Edit.
`reset_to_automatic` entsteht nur beim Entfernen einer aktiven Präferenz.
Unverändertes Speichern und technische Legacy-Normalisierung erzeugen kein
Event. Die App verbindet sich ausschließlich mit der Haupt-Supabase.

## Umsetzungsreihenfolge

1. Taxonomie und Legacy-Adapter anlegen.
2. Klassifikator, Resolver und Gruppierung auf V2 umstellen.
3. Store-Scope in Präferenz-API und Hooks ergänzen.
4. `PlacementZoneField` integrieren.
5. Speichern an Backend-/Outbox-Implementierung anschließen.
6. Tests für Add, Edit, Marktwechsel, Reset und Legacy-Fälle ergänzen.

Vor der Komponentenänderung werden statische Formular-Mocks erstellt. Es
werden keine neuen Listengesten oder UI-Flächen eingeführt.

## Akzeptanzkriterien

- Sichtbares Label ist „Einkaufsbereich“.
- „Automatisch“ und alle 27 Zonen sind auswählbar.
- Reihenfolge folgt Markt oder Standardtaxonomie.
- Auswahl wird erst durch Speichern wirksam.
- Abbrechen und unverändertes Speichern erzeugen kein Event.
- Store-Präferenzen beeinflussen keinen anderen Markt.
- Legacy-IDs bleiben lesbar und werden nicht blind per SQL umgeschrieben.
- Long Press, normales Tippen und Einkaufsmodus bleiben unverändert.
- Dark Mode, große Schrift und Screenreader bleiben nutzbar.

## Nicht Bestandteil

Neue Schnellaktionen, Gesten, Drag-and-drop, Undo, Snackbar, Lernanzeige,
sichtbarer Crowd-/Sync-Status, automatische globale Regeln, automatisches
Training oder automatisches Publishing.
