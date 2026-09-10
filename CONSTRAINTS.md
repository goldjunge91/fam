# Constraints

Status: nicht freigebeben
Letzte Festlegung: 2026-09-10.

Diese Datei ist die einzige verbindliche Qualitäts- und Arbeitsvereinbarung des
Repositories. Sie gilt für alle Produktions-, Test-, Datenbank-, Sync- und
Dokumentationsänderungen. Fachliche Domänenverträge konkretisieren das
Zielverhalten ihrer Domäne und dürfen diese Qualitätsgrenzen nicht abschwächen.

## Harte Grundsätze

- **KISS / DRY / YAGNI:** Jede Änderung wählt den einfachsten bestehenden
  Owner, vermeidet doppelte fachliche Entscheidungen und führt keine
  vorsorgliche Erweiterbarkeit ein. Eine neue Datei, Abstraktion oder
  Indirektion ist nur zulässig, wenn sie für den Contract nachweislich nötig
  ist und im Beads-Ticket begründet wird.
- Der Operationsvertrag wird vor Produktionscode erstellt und freigegeben.
- Jede fachliche Entscheidung besitzt genau einen benannten Produktionscode-Owner.
  Mehrere benannte Verantwortlichkeiten dürfen in einer vorhandenen Datei
  liegen. Eine Operation rechtfertigt keine eigene Datei.
- Fehlende Owner dürfen erstellt werden, wenn die Aufgabe nach dokumentierter
  KISS-/DRY-/YAGNI-Prüfung keinen bestehenden Owner sinnvoll erweitern kann.
  Die neue Datei besitzt genau eine Verantwortung; kein Command-Verzeichnis,
  kein Executor, keine Registry und kein zusätzliches Contract-Modul.
- Reine Strukturänderungen und fachliche Korrekturen werden getrennt geprüft.
  Bei Strukturänderungen bleiben Testerwartungen gleich; eine geänderte
  Erwartung muss eine ausdrücklich benannte fachliche Contract-Regel prüfen.
- Andere Schichten dürfen Werte transportieren und Feldnamen abbilden, aber
  dieselbe fachliche Entscheidung weder erneut interpretieren, berechnen,
  klassifizieren noch reconciliieren. Form-, Auth-, Snapshot- und
  Constraint-Validierung an der jeweils zuständigen Vertrauensgrenze bleibt
  Pflicht, darf aber keine zweite fachliche Regel enthalten.
- Eine zweite ähnliche Funktion ist verboten, auch bei anderem Namen oder leicht anderer Struktur.
- Neue Funktionen verwenden einen bestehenden Owner oder erweitern zuerst den Contract.
- Keine neue allgemeine Sync-, Queue- oder Plugin-Abstraktion.
- Keine manuellen Supabase-Migrationen. Quelle bleibt `supabase/schemas/*.sql`.

## Floor (immer erzwungen)

- Keine neuen Suppression-Kommentare wie `@ts-ignore` oder
  `eslint-disable`, `biome-ignore`.
- Keine übersprungenen oder gelöschten Tests ohne begründete Dokumentation im
  Beads-Task.
- Keine unimplementierten Stubs wie `throw new Error("Not implemented")` oder
  leere `catch`-Blöcke.
- Keine Secrets in Quelltext, Tests, Logs oder Dokumentationsbeispielen.
- Diese Datei wird nicht abgeschwächt, damit eine Änderung grün erscheint.

### I1: Typen und Eingangsvalidierung

- Kein neues `any`, `as any`, `as unknown as`, `as never` oder Non-null-Assertion
  zum Umgehen fehlender Beweise. Ein Cast ersetzt keine Laufzeitvalidierung.
  Typinferenz und Narrowing verwenden; keine reinen Casting-Wrapper.

### I6: Tests und Review als Abnahme

- Tests prüfen beobachtbare Wirkung und Fehlerfälle des geänderten Vertrags.
  Den getesteten Owner nicht mocken. Atomarität durch einen Fehler zwischen
  Schreibschritten und Prüfung des verbleibenden DB-Zustands belegen;
  Mock-Aufrufzählungen beweisen keinen Rollback.
- Betroffene Grenzfälle gezielt prüfen: ungültiger Payload, Mengengrenze,
  Retry/Antwortverlust oder Race, soweit der Schritt diese Verantwortung ändert.
  Keine pauschalen Snapshots, gelockerten Assertions oder entfernten Tests.
  Architektur-Gate muss verbotene Imports erkennen, nicht nur Dateien zählen.
- Vor Abschluss den Diff in fünf Achsen prüfen: **Korrektheit** gegen Contract
  und Fehlerfälle, **Lesbarkeit** des Kontrollflusses, **Architektur** gegen
  Owner und Duplikate, **Sicherheit** an Vertrauensgrenzen, **Performance** auf
  Abfrageschleifen und unbeschränkte Arbeit. Je Achse Ergebnis und konkrete
  Fundstelle oder Nachweis kurz im Beads-Ticket festhalten.
- Kritische und erforderliche Reviewkorrekturen blockieren Abschluss;
  optionale Stilhinweise werden als optional bezeichnet. Fehlende Nachweise
  bleiben offen. Kein „grün“ aus ausschließlich selbst bestätigten Assertions.

## Qualitätsgrenzen und Nachweise

Typecheck, Format/Lint, fokussierte Verhaltenstests, das 90-Sekunden-Limit
und der deklarative Datenbank-Workflow gelten für die gesamte App.

### Verbindliche Ratchets

1. Neue oder neu bearbeitete Produktionsdateien zielen auf 250–400 Effective
   LOC. 250 LOC ist keine Auffüllpflicht; eine kleinere kohärente Datei ist
   zulässig, wenn ihre Verantwortung vollständig und begründet ist. Mehr als
   400 Effective LOC ist für neue Produktionsdateien nicht zulässig.
2. Bestehende Produktionsdateien über 400 Effective LOC erhalten eine
   dokumentierte Ausnahme mit Pfad, Baseline, Owner, Reduktionsziel und
   Ablaufdatum. Die Ausnahme erlaubt kein Wachstum.
3. Eine reine Strukturänderung darf die Gesamtzahl der Effective LOC im
   betroffenen festen Scope nicht erhöhen. Verschobene Zeilen zählen nur dann
   als Reduktion, wenn die alte fachliche Implementierung und ihr alter
   Aufrufpfad entfallen.
4. Exakte normalisierte Duplikatgruppen dürfen sich nicht erhöhen. Die
   Baselines sind vier Gruppen ohne Tests und acht Gruppen einschließlich
   Tests/Harnesses. Jede verbleibende Gruppe wird als fachlich begründet oder
   als abzubauendes Duplikat im Ticket klassifiziert.
5. Eine Metrik rechtfertigt keine eigenständige Produktionsänderung. Jede
   Reduktion muss zugleich eine Contract-Regel, einen Owner-Grenzfall oder
   eine konkrete doppelte Entscheidung vereinfachen.
6. Die bestehenden harten Gates bleiben unabhängig davon aktiv: Typecheck,
   Biome, fokussierte Tests, 90-Sekunden-Limit, Ownership-Gate und die
   fünf Reviewachsen. Ein Messwert ersetzt keinen Verhaltensnachweis.

Eine Contract-Änderung muss gleichzeitig aktualisieren:

1. den verbindlichen Operationsvertrag,
2. das Operationsregister und den benannten Owner,
3. den kurzen Ausführungsplan, falls Reihenfolge oder Dateigrenzen betroffen sind,
4. die fokussierten Nachweise.

Produktionscode darf erst nach diesen Dokumentänderungen beginnen. Eine
Zeilenreduktion allein ist kein Erfolgskriterium. Erfolg bedeutet weniger
fachliche Mehrfachimplementierung bei unverändertem oder ausdrücklich
vertraglich korrigiertem Verhalten.
