# Implementierungsplan: Dashboard ohne Netz beim Start

Status: Plan zur Maintainer-Freigabe
Spec: [docs/specs/dashboard-offline-start/SPEC.md](../docs/specs/dashboard-offline-start/SPEC.md)
Parent-Bead: `fam-gfyi`

Die Umsetzung ist als MEDIUM eingestuft. Die niedrigste ausreichende
Planungs-/Coding-Lane ist empfohlen. Ein Modellwechsel wurde nicht behauptet,
weil die Codex-Oberfläche ihn nicht bestätigt.

## Ziel und Grenzen

Der lokale, accountgebundene Präferenzwert muss beim Start ohne Netz verfügbar
sein. Das Dashboard darf nicht wegen einer pausierten Remote-Abfrage leer
rendern. Die einmalige Startauswahl besteht aus Vorrat, Einkaufsliste und
Essensplaner. Rezepte und Kalorientracking starten inaktiv. Spätere
Nutzerauswahl bleibt unverändert möglich.

Enthalten sind der Read-Pfad, die bestehende verschlüsselte Query-Persistenz,
die Startauswahl und der Dashboard-Konsument. Nicht enthalten sind
Offline-Mutationen, Outbox-Synchronisierung, ein SQLite-Profilspiegel,
Supabase-Schemaänderungen, Routing aus `fam-ho6e`, neue Abhängigkeiten und
visuelle Neugestaltung.

## Reihenfolge und Unabhängigkeit

Die Beads sind die maßgebliche Aufgabenliste. Dieser Plan ist nur der
geordnete Index mit Grenzen und Abhängigkeiten.

| Reihenfolge | Bead | Arbeitsfläche | Abhängigkeit | Parallelisierbar |
| --- | --- | --- | --- | --- |
| 1 | `fam-gfyi.1` | Einmalige Startauswahl im Modul-Owner, Onboarding und Feature-Access | keine | ja, mit `fam-gfyi.2` |
| 2 | `fam-gfyi.2` | Persistenz und Hydration der erfolgreichen Settings-Query | keine | ja, mit `fam-gfyi.1` |
| 3 | `fam-gfyi.4` | Local-first Hook: Snapshot, Startauswahl, Refresh und Fehlererhalt | `.1` und `.2` | nein, nutzt beide Verträge |
| 4 | `fam-gfyi.6` | CardList ohne leeren Renderpfad und Dashboard-Nachweis | `.4` | nein, konsumiert die Hook-Garantie |
| 5 | `fam-gfyi.7` | MealPlannerScreen ohne eigenen Präferenz-Fallback | `.4` | ja, mit `fam-gfyi.6` |

Die Aufgaben sind separat implementierbar, weil jede Aufgabe einen eigenen
Owner, einen begrenzten Dateisatz, eigene Akzeptanzkriterien und eigene
fokussierte Nachweise besitzt. Vollständige Parallelität wäre fachlich nicht
ehrlich: Der Hook darf die Startauswahl und die Persistenz nicht duplizieren,
und CardList sowie MealPlannerScreen dürfen keine eigene Fallback-Regel
einführen. Die Abhängigkeiten sind daher bewusst explizit und azyklisch.

Der Kontext-Scan hat zusätzlich den direkten Produktionskonsumenten
`src/features/meal-planner/meal-planner-screen.tsx` gefunden. Er ist als
`fam-gfyi.7` separat erfasst, damit die Dashboard-Aufgabe klein bleibt und
beide Konsumenten nach dem Hook-Vertrag parallel angepasst werden können.

## Kontrollpunkte

Nach `fam-gfyi.1` und `fam-gfyi.2` wird unabhängig geprüft, dass Startauswahl
und Persistenz jeweils für sich funktionieren. Dafür werden nur die in den
Beads genannten fokussierten Tests sowie `bun run check` und
`bun run typecheck` ausgeführt.

Nach `fam-gfyi.4` wird der lokale Read-Vertrag geprüft. Danach können
`fam-gfyi.6` und `fam-gfyi.7` unabhängig voneinander umgesetzt werden. Der
abschließende fokussierte Nachweis muss Snapshot, Startauswahl, Offline-Pause,
Reconnect-Erfolg, Reconnect-Fehler, Accountgrenze, Dashboard-Render und den
MealPlanner-Rezeptzugriff abdecken. Ein manueller Flugmodus-Nachweis kann
anschließend mit dem vorhandenen Dev Client erfolgen; eine native
Neuerstellung ist für reine JS-/TS-Änderungen nicht vorgesehen.

## Verbindliche Umsetzungsregeln

- `src/features/settings/module-preferences.ts` bleibt der einzige Owner der
  Modulbedeutung und der einmaligen Startauswahl.
- Die Konstante für die einmalige Startauswahl wird fachlich präzise benannt;
  ein all-true-Produktionsfallback bleibt entfernt.
- Dashboard- und MealPlanner-Konsument prüfen nicht selbst auf fehlende
  Remote-Daten und erfinden keine zweite Startauswahl.
- Die Persistenz bleibt verschlüsselt und accountgebunden.
- Offline-Mutation und Outbox werden als Folgearbeit behandelt.
- Es werden keine Supabase-Migrationen, SQLite-Schemata oder neuen Pakete
  angelegt.
- Vor Änderungen an React-Native-Tests wird
  `node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md`
  gelesen.

## Verifikation durch Jev

Jev wurde mit diesem konkreten Plan, dem Dependency-Graphen und den
fokussierten Verifikationsbefehlen befragt. Die Prüfung ist eine begrenzte
Einschätzung von Komplexität, Trennbarkeit und möglichem Scope-Leak. Test-,
Typecheck-, Lint- und Diff-Aussagen bleiben deterministischen Werkzeugen
vorbehalten.

Ergebnis vom 2026-09-28 mit `typesafe/jev-1.13-20260917`: 5 von 5 bounded
Checks waren positiv.

- Getrennte Implementierungspassagen: `0.75`
- Unabhängigkeit der Wurzelaufgaben `.1` und `.2`: `0.89`
- Notwendigkeit und ausreichende Reichweite der Kanten `.4` und `.6`: `0.88`
- Einhaltung der Scope-Grenzen: `0.94`
- Plausibilität der Einstufung MEDIUM: `0.79`

Diese Wahrscheinlichkeiten sind Evidenz für die Planqualität und keine
Beweise. Die Abhängigkeitsrichtung und die Anzahl der Aufgaben wurden separat
mit Beads geprüft.

Nach der Ergänzung von `fam-gfyi.7` wurde die Zerlegung am 2026-09-28 erneut
geprüft. Auch diese fünf Checks waren positiv: Unabhängigkeit von `.1` und
`.2` `0.86`, Parallelisierbarkeit von `.6` und `.7` nach `.4` `0.93`,
begrenzter Scope von `.7` `0.88`, Scope-Grenzen `0.97` und MEDIUM-Lane `0.82`.

## Source-Driven-Basis

Der Stack wurde aus `package.json` und dem Laufzeitcode geprüft:

- Expo `~57.0.19`, React `19.2.3`, React Native `0.86.3`.
- TanStack React Query `^5.102.3`.
- Die App bindet `onlineManager` bereits über `expo-network` an den nativen
  Netzwerkstatus.
- Die bestehende Persistenz ist ein eigener accountgebundener Persister über
  `dehydrate` und `hydrate`; es wird kein neues Persistenzpaket eingeführt.

Für die spätere Umsetzung gelten diese offiziellen TanStack-Query-Quellen:

- `placeholderData` stellt Daten für den Render bereit, ohne sie im Cache zu
  persistieren. Das passt zur einmaligen Startauswahl, die nicht als
  Nutzersnapshot gespeichert werden soll:
  https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data
- `initialData` wird dagegen im Cache persistiert; deshalb ist es für den
  fachlichen Startfallback nicht die passende Option:
  https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/QueryOptions
- Das Standard-`networkMode: 'online'` pausiert Remote-Abfragen offline und
  setzt sie bei Verbindung fort. Die vorhandene React-Native-Anbindung des
  `onlineManager` ist dafür der maßgebliche Integrationspunkt:
  https://tanstack.com/query/latest/docs/framework/react/react-native
  und https://tanstack.com/query/latest/docs/framework/react/reference/type-aliases/NetworkMode
- TanStack Query unterstützt einen eigenen Persister sowie Restore und
  Subscribe für den Query-Cache. Das bestätigt die bestehende Architektur,
  ohne eine zusätzliche Storage-Schicht zu rechtfertigen:
  https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

Nicht durch Dokumentation ersetzt werden die projektspezifischen Nachweise:
  Account-Isolation, der Supabase-Fehlerpfad, die genaue CardList-Ausgabe und
  der Reconnect-Test müssen im vorhandenen Code und in fokussierten Jest-Tests
  belegt werden.

## WatchOS-Folgeslice

Der native watchOS-Snapshot bleibt als separater, noch nicht abgenommener
Folgeslice in Bead `fam-6i69` dokumentiert. Die Watch-Implementierung darf den
Dashboard-Plan nicht als dessen Eigentümer überschreiben.
