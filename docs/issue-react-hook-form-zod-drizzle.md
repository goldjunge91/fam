# React Hook Form, Zod und Drizzle als App-Form- und lokale Datenbankschicht

## Ziel

Die App soll für Formulare und die lokale SQLite-Datenbank einen klaren, typisierten Datenfluss erhalten:

```text
React Native UI
  -> React Hook Form
  -> Zod
  -> Feature-API / Mutation
  -> Drizzle
  -> expo-sqlite
  -> lokaler SQLite-Mirror und Outbox

TanStack Query -> Server-State und Cache
Zustand         -> UI-/Client-State
```

## Verbindliche Entscheidungen

- React Hook Form ist die Form-State-Schicht für neue und migrierte komplexe Formulare.
- Zod bleibt die Validierungs- und Input-Normalisierungsschicht.
- React Native-Felder werden über `Controller` oder wiederverwendbare RHF-Feldadapter angeschlossen. Es wird kein Web-`register`-Muster in Native-Komponenten erzwungen.
- Drizzle wird ausschließlich für die lokale SQLite-Datenbank verwendet. Supabase bleibt die Remote-Datenbank und ihre deklarativen Schemata unter `supabase/schemas/*.sql` bleiben die Wahrheit für das Server-Schema.
- Die bestehende Local-First- und Outbox-Semantik bleibt erhalten: synchronisierte Mutationen schreiben zuerst lokal in SQLite und werden anschließend über die bestehende Outbox synchronisiert.
- TanStack Query bleibt für Server-State, Fetching, Cache, Reconnect und Mutations-Orchestrierung zuständig. Es wird nicht durch Zustand ersetzt.
- Zustand wird nur für UI-/Client-State eingesetzt, nicht für persistente Haushalts- oder Trackingdaten.
- Es gibt keine parallele zweite fachliche Wahrheit in React Hook Form, Zustand, TinyBase oder TanStack Query.
- Bestehende einfache Ein-Feld-Formulare müssen nicht aus Prinzip migriert werden. Die Migration beginnt bei neuen und komplexen Formularen.

## Ausgangslage

Bereits vorhanden:

- Expo SDK 57, React Native 0.86 und TypeScript strict.
- `zod` ist installiert und wird bereits für Auth-Schemas verwendet.
- TanStack Query ist zentral in `src/lib/query-client.ts` eingerichtet und mit AppState sowie Netzwerkstatus verbunden.
- Die lokale SQLite-Schicht liegt hinter `src/lib/db/client.ts` und einem `SqlDatabase`-Port.
- Die lokale DB enthält Mirror-, Outbox-, Sync- und private Trackingpfade.
- Die UI verwendet aktuell mehrere eigene Formularzustände und React-Native-Listen.

Noch nicht vorhanden beziehungsweise umzubauen:

- `react-hook-form` und `@hookform/resolvers` fehlen.
- Drizzle ist noch nicht installiert.
- Die lokale SQLite-Schicht verwendet aktuell handgeschriebene SQL-Migrationen und einen eigenen Statement-Port.
- Die bestehenden Formulare verwenden nicht durchgängig ein gemeinsames Form-State-Modell.

## Abhängigkeiten

Produktionsabhängigkeiten:

- `react-hook-form` in der stabilen 7.x-Linie. Keine 8.x-Beta.
- `@hookform/resolvers` in der aktuellen stabilen Version.
- `drizzle-orm@rc` entsprechend der aktuell dokumentierten Expo-Integration.
- `expo-sqlite`: Die Drizzle-Anleitung nennt aktuell `expo-sqlite@next`; für dieses Expo-SDK muss vor der Installation geprüft werden, ob `next` tatsächlich zu SDK 57 passt. Expo SDK 57 empfiehlt offiziell `expo-sqlite~57.0.1`. Es darf nicht einfach eine Expo-SDK-fremde `next`-Version installiert werden.

Entwicklungsabhängigkeit:

- `drizzle-kit`, sofern die gewählte Drizzle-/Expo-Konfiguration es für Schema- und Migrationswerkzeuge benötigt.

Die bevorzugte Installationsentscheidung für dieses Repository ist zunächst:

```bash
bun add drizzle-orm@rc
bun add -D drizzle-kit@rc
bunx expo install expo-sqlite
```

`expo-sqlite@next` ist nur zulässig, wenn die Peer-Dependencies und die native API nachweislich mit Expo SDK 57 kompatibel sind. Andernfalls bleibt die bereits installierte SDK-57-Version erhalten und Drizzle wird gegen deren öffentliche Expo-SQLite-API integriert.

Installation erfolgt über Bun. Die finalen Versionen werden beim Implementieren gegen den installierten Expo-/React-Native-Stack geprüft und im Lockfile festgehalten.

Quellen:

- [React Hook Form React Native](https://react-hook-form.com/get-started#ReactNative)
- [Drizzle mit Expo](https://orm.drizzle.team/docs/get-started/expo-new#get-started-with-drizzle-and-expo)

## React Hook Form und Zod

### Gemeinsames Muster

Jedes migrierte Formular erhält:

1. ein Zod-Schema im jeweiligen Feature;
2. einen daraus abgeleiteten Input-Typ;
3. `useForm` mit typisierten `defaultValues`;
4. `zodResolver`;
5. RN-kompatible Field-Komponenten über `Controller`;
6. eine Submit-Funktion, die nur validierte Daten an die Feature-API weitergibt.

Beispielstruktur:

```text
src/features/<domain>/
  forms/
    <form>-schema.ts
    <form>-form.tsx
  api.ts
```

Das Zod-Schema validiert Eingabegrenzen und Formate. Fachliche Regeln, die eine lokale DB-Transaktion, Household-Berechtigung oder Serverantwort benötigen, bleiben in der Domain-/API-Schicht und werden nicht ausschließlich als UI-Validierung modelliert.

### Priorisierte Migration

1. Neue Formulare ab sofort mit React Hook Form und Zod.
2. Rezept-Erstellung und Rezept-Bearbeitung.
3. Profil- und private Tracking-Formulare.
4. Inventory-/Produkt-Add- und Edit-Formulare.
5. Einkaufslisten-Formulare, sofern sie durch die bestehende Kategorie-/Placement-Logik ohnehin angefasst werden.
6. Kleine Auth- oder Einstellungsformulare nur bei fachlicher Änderung.

### Anforderungen für React Native

- Bestehende `TextInput`- und Picker-Komponenten erhalten dünne, typisierte Adapter statt formabhängiger Sonderlogik.
- `onChangeText`, `onBlur`, `value` und Fehlermeldungen werden vollständig an RHF angebunden.
- Submit-Buttons verwenden `isSubmitting` beziehungsweise `canSubmit`-ähnlichen Status aus dem Form-State.
- Fehlertexte sind pro Feld sichtbar und bleiben mit dem bestehenden Design-System kompatibel.
- Unmount und Modal-/Sheet-Schließen dürfen keine ungespeicherten Daten still verlieren, sofern der bestehende Flow einen Abbruch bestätigt.

## Drizzle und lokale SQLite-Datenbank

### Zielarchitektur

Drizzle wird als typisierte Query-/Schema-Schicht über `expo-sqlite` eingeführt. Die bestehende DB-Abstraktion bleibt zunächst als Stabilitätsgrenze bestehen:

```text
Feature hooks / mutations
  -> repositories / domain queries
  -> Drizzle query builder
  -> SqlDatabase / expo-sqlite adapter
```

Die Sync-Engine spricht weiterhin über ihre bestehenden Ports und erhält keinen direkten UI-Zugriff auf Drizzle- oder Expo-SQLite-Details.

### Migrationsstrategie

- Zuerst das bestehende lokale SQLite-Schema vollständig gegen Drizzle-Schemaobjekte abgleichen.
- Die bestehende Mirror-/Outbox-Semantik, Ownership-Prüfung, WAL-/Locking-Regeln und Transaktionsserialisierung erhalten.
- Drizzle-Schreibpfade zunächst für einen klar abgegrenzten Read-/Write-Bereich einführen und mit den bestehenden Integrationstests absichern.
- Erst danach die restlichen Feature-Queries migrieren.
- Keine parallelen Schreibpfade für dieselbe Tabelle ohne expliziten Test- und Übergangsplan.
- Die von Drizzle Kit erzeugten lokalen SQL-Migrationen werden als gebündelte App-Ressourcen ausgeliefert und beim DB-Start angewendet. Sie dürfen nicht erst zur Laufzeit aus dem Dateisystem nachgeladen werden.
- Supabase-Schemaänderungen bleiben ausschließlich in `supabase/schemas/*.sql`; Drizzle darf diese Server-Schemata nicht ersetzen.
- Für synchronisierte Entitäten müssen lokale SQLite-, Entity-, Pull-, Push- und Outbox-Parität sowie die bestehenden pgTAP-Tests erhalten bleiben.

### Expo-/Metro-Konfiguration

Die aktuelle Drizzle-Expo-Dokumentation verlangt für gebündelte SQL-Migrationen:

- `babel-plugin-inline-import` mit der Erweiterung `.sql` in `babel.config.js`;
- `sql` in `config.resolver.sourceExts` in `metro.config.js`;
- `drizzle.config.ts` mit `dialect: 'sqlite'`, `driver: 'expo'`, `schema` und `out`;
- generierte Migrationen und Snapshots unter einem eingecheckten lokalen Drizzle-Verzeichnis;
- `useMigrations` beziehungsweise den passenden Drizzle-Migrator erst vor dem Rendern der datenbankabhängigen App-Bereiche.

Die bestehende Initialisierung in `src/lib/db/client.ts` serialisiert Zugriffe, prüft die Datenbank-Ownership und behandelt WAL-/Locking-Probleme. Diese Verantwortungen dürfen nicht durch einen zweiten, unkoordinierten `openDatabaseSync`-Singleton oder einen parallelen Migrator dupliziert werden. Der Drizzle-Client muss in diese bestehende DB-Lebensdauer integriert werden.

### Drizzle darf nicht tun

- Keine Haushalts- oder privaten Trackingdaten in MMKV oder Zustand verschieben.
- Keine Umgehung der lokalen Outbox bei synchronisierten Mutationen.
- Keine direkten Supabase-Schreibzugriffe aus Formular-Komponenten.
- Keine zweite, vom lokalen Schema abweichende Definition derselben fachlichen Tabellen ohne dokumentierte Projektion.

## Zusammenspiel mit TanStack Query

- `useQuery` liest Server-State oder lokale Read-Modelle über Feature-Hooks.
- `useMutation` koordiniert Mutationsstatus, Fehler und Invalidierung.
- Das Formular liefert validierte Daten an die Mutation, verwaltet aber nicht deren Cache.
- Optimistische lokale Updates bleiben in SQLite/Drizzle und der Outbox; TanStack Query invalidiert beziehungsweise aktualisiert die betroffenen Views.
- Die bereits vorhandene Query-Persistenz bleibt auf die vorgesehenen privaten Cache-Domänen begrenzt. Haushaltsdaten werden nicht zusätzlich als redundanter Query-Cache persistiert, wenn SQLite bereits die lokale Quelle ist.

## Zusammenspiel mit Zustand und MMKV

- Zustand wird für UI-State wie Filter, offene Sheets, temporäre Auswahl und Navigation verwendet.
- MMKV kann die kleinen, gerätebezogenen Zustand-Stores synchron persistieren.
- Eine AsyncStorage-Migration muss namespaced und fehlertolerant erfolgen; der globale „alle Keys kopieren und löschen“-Ansatz aus einem Beispiel darf nicht ungeprüft auf alle App-Keys angewendet werden.
- Auth-Secrets bleiben in SecureStore.
- SQLite bleibt für strukturierte und synchronisierte Daten zuständig.

## Akzeptanzkriterien

- [ ] `react-hook-form`, `@hookform/resolvers`, `drizzle-orm` und gegebenenfalls `drizzle-kit` sind mit Expo SDK 57 kompatibel installiert.
- [ ] `expo-sqlite` bleibt auf einer nachweislich mit Expo SDK 57 kompatiblen Version; eine `@next`-Version wird nur nach erfolgreicher Peer-/Native-Kompatibilitätsprüfung verwendet.
- [ ] SQL-Migrationsdateien werden über Babel/Metro in das native Bundle aufgenommen und in einem frischen Development Build ausgeführt.
- [ ] Mindestens ein komplexes React-Native-Formular verwendet `useForm`, `Controller` und `zodResolver` vollständig.
- [ ] Zod-Schema, Input-Typ und Submit-Payload sind typisiert und ohne `any`.
- [ ] Validierungsfehler, Loading-State und Submit-Fehler sind im bestehenden UI sichtbar.
- [ ] Mindestens ein lokaler Read-/Write-Pfad verwendet Drizzle über die bestehende SQLite-Grenze.
- [ ] Die bestehende Datenbank-Ownership-Prüfung und die Transaktionsserialisierung bleiben intakt.
- [ ] Eine synchronisierte Mutation läuft weiterhin über Mirror-Write und Outbox.
- [ ] TanStack Query bleibt der Server-State-Layer und wird nicht durch Formular- oder Zustand-State ersetzt.
- [ ] Bestehende relevante Unit- und Integrationstests bleiben grün; neue Tests decken Schema-Validierung, Submit-Payload und lokalen Repository-Write ab.
- [ ] `bun run check` und `bun run typecheck` sind erfolgreich.
- [ ] Betroffene Jest-Tests laufen gezielt über `bun run test <file>`.
- [ ] Falls lokale DB-Strukturen geändert werden, laufen die betroffenen DB-Tests über `bun run test:db <file>` beziehungsweise den vorgesehenen DB-Workflow.

## Nicht Bestandteil dieses Issues

- Vollständige Migration aller bestehenden Formulare in einem einzelnen PR.
- Ersetzen von Supabase durch Drizzle.
- Ersetzen der bestehenden Outbox-/Realtime-Sync-Engine.
- Einführung von Expo API Routes.
- Migration sämtlicher AsyncStorage-Nutzer ohne getrenntes Migrations-Issue.
- Austausch aller `FlatList`-/`SectionList`-Komponenten durch FlashList.

## Empfohlene Umsetzung in Teil-PRs

1. Abhängigkeiten, gemeinsame Zod-/RHF-Konvention und ein Referenzformular.
2. Drizzle-Adapter und ein abgegrenztes lokales Repository mit Tests.
3. Migration weiterer Formulare nach Priorität.
4. Weitere Drizzle-Queries und kontrollierte Ablösung der alten SQL-Zugriffe.
5. Optional: Zustand-/MMKV-Persistenz und separate AsyncStorage-Migration.
