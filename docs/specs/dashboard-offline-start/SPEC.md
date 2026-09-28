# Spec: Dashboard ohne Netz beim App-Start

**Status:** Entwurf, Maintainer-Review erforderlich  
**Version:** 0.1  
**Stand:** 2026-09-28  
**Bead:** fam-gfyi  
**Verwandter Bead:** fam-ho6e für den lokalen Haushaltsstart

## Objective

Ein authentifizierter Nutzer soll die App im Flugmodus starten können und auf
dem Dashboard den zuletzt lokal bekannten Zustand sehen. Das Dashboard darf
nicht leer bleiben, nur weil die Remote-Abfrage der persönlichen
Modulpräferenzen beim Start pausiert oder fehlschlägt.

Der lokale Start gilt als erfolgreich, wenn Session, Account-Bootstrap und ein
lokaler Haushalt vorhanden sind. Die Remote-Erreichbarkeit darf den ersten
Dashboard-Render nicht blockieren. Sobald das Netz wieder verfügbar ist, darf
der Remote-Zustand den lokalen Zustand aktualisieren.

### User Stories

- Als authentifizierter Nutzer möchte ich die Dashboard-Karten im Flugmodus
  sehen, damit die App beim Öffnen bedienbar bleibt.
- Als Nutzer möchte ich, dass meine zuletzt gewählten Modulpräferenzen auch
  ohne Netz gelten.
- Als Nutzer möchte ich bei fehlendem lokalem Präferenz-Snapshot die einmalig
  definierte Startauswahl sehen und keine leere Fläche.

## Aktueller Befund

Der Fehler ist im bestehenden Read- und Renderpfad belegt:

1. src/features/settings/module-preferences.ts liest die Präferenzen aus
   profiles über Supabase. Die Mutation schreibt ebenfalls direkt nach
   Supabase und aktualisiert nur den React-Query-Cache optimistisch.
2. src/lib/data/query-client.ts persistiert nur Queries mit den Präfixen
   profile und calorie-tracking. Der Schlüssel
   settings/module-preferences/userId wird nicht dauerhaft wiederhergestellt.
3. src/features/dashboard/components/card-list.tsx liefert null, wenn
   modules noch nicht vorhanden ist. Dadurch fehlen alle Karten, obwohl andere
   Dashboard-Abfragen bereits aus SQLite lesen können.
4. Die lokalen Haushalts-, Inventar-, Einkaufslisten- und Essensplan-Abfragen
   verwenden bereits lokale Reads mit networkMode always. Die
   Modulpräferenzen folgen diesem Local-First-Pfad noch nicht.

## Scope

### In Scope

- Accountgebundene, dauerhafte lokale Verfügbarkeit der zuletzt erfolgreichen
  Modulpräferenzen.
- Sofortiger lokaler Read beim Offline-Start, ohne eine Remote-Antwort als
  Voraussetzung für den ersten Dashboard-Render.
- Einmalig definierte Startauswahl der verfügbaren Module, falls für einen
  neuen Account noch keine Nutzerauswahl existiert.
- Remote-Refresh nach Wiederherstellung der Verbindung, ohne den vorhandenen
  lokalen Wert beim Offline-Fehler zu löschen.
- Kein leerer Dashboard-Render, wenn der aktive Account bereit ist.
- Fokussierte Tests für Persistenz, Offline-Read, Fallback, Dashboard-Render
  und Reconnect-Refresh.

### Out of Scope für diese Spec

- Änderung des Supabase-Schemas, der RLS-Policies oder der Profile-Spalten.
- Änderung des bestehenden Haushalts-Bootstraps aus fam-ho6e.
- Neue externe Abhängigkeiten.
- Neugestaltung der Dashboard-Oberfläche oder neue Karten.

**Entscheidung:** Option B. Die Offline-Bearbeitung und
Outbox-Synchronisierung von Modulpräferenzen gehört nicht zu diesem Bead und
wird als eigener Folge-Bead behandelt. Dieser Bead repariert ausschließlich
den lokalen Read- und Renderpfad beim Start.

## Zielvertrag

Für einen aktiven, authentifizierten Nutzer liefert
useModulePreferences(userId) einen lokal verfügbaren Wert oder die einmalig
definierte Startauswahl, bevor ein Remote-Refresh erfolgreich sein muss.

### Einmalige Startauswahl

Beim ersten Account-Setup werden diese Module aktiv festgelegt:

- Vorrat (`fridge`)
- Einkaufsliste (`shoppingList`)
- Essensplaner (`mealPlanner`)

Rezepte (`recipes`) und Kalorientracking (`calories`) starten nicht aktiv. Die
Startauswahl ist ein initialer Zustand, keine dauerhafte Sperre. Eine spätere
Nutzerauswahl kann die Modulpräferenzen erweitern oder einschränken.

Der fachliche Owner bleibt src/features/settings/module-preferences.ts:

- Die Bedeutung der Module und die einmalige Startauswahl bleiben an einer
  Stelle.
- Dashboard-Komponenten prüfen nicht selbst, ob Remote-Daten fehlen.
- Persistenz- und Wiederherstellungsmechanik nutzt bestehende
  accountgebundene lokale Infrastruktur.
- Ein Accountwechsel oder Logout darf keinen Präferenzwert des vorherigen
  Accounts sichtbar lassen.

### Beobachtbare Abläufe

#### Offline-Start mit lokalem Snapshot

Gegeben:

- eine gültige lokale Session,
- ein accountbereiter lokaler Zustand,
- ein lokal bekannter Haushalt,
- ein lokal gespeicherter Präferenz-Snapshot,
- kein erreichbares Netz.

Dann:

- routet die App in den authentifizierten Bereich,
- zeigt das Dashboard Karten entsprechend dem lokalen Snapshot,
- startet kein Remote-Laden als Voraussetzung für diesen Render,
- bleibt der lokale Wert erhalten, obwohl ein Remote-Request pausiert oder
  fehlschlägt.

#### Offline-Start ohne lokalen Snapshot

Ohne lokalen Präferenz-Snapshot zeigt das Dashboard die Karten aus der
einmalig definierten Startauswahl. Diese Startauswahl ist keine wiederkehrende
All-True-Regel und keine Ersetzung der späteren Nutzerauswahl. Es entsteht kein
leerer CardList-Render. Ein späterer Online-Refresh kann die tatsächlichen
Präferenzen übernehmen.

#### Reconnect

Wenn die Verbindung wieder verfügbar ist, darf ein Remote-Refresh den lokalen
Wert ersetzen. Ein erfolgloser Refresh darf den zuletzt erfolgreichen lokalen
Wert nicht durch undefined, eine leere Kartenliste oder einen Fehlerzustand
ersetzen.

#### Accountgrenze

Die lokale Persistenz ist an den Account gebunden. Nach Accountwechsel oder
Logout sind keine Modulpräferenzen des vorherigen Accounts abrufbar.

## Tech Stack und bestehende Owner

- Expo SDK 57, React Native 0.86, React 19.
- TanStack React Query für Query-Zustand und Remote-Refresh.
- src/lib/storage/local-account-storage.ts für verschlüsselten,
  accountgebundenen lokalen Key-Value-Speicher.
- src/lib/data/query-client.ts für bestehende accountgebundene
  Query-Persistenz und Netzwerkzustandsintegration.
- src/features/settings/module-preferences.ts als fachlicher Owner für
  Präferenztypen und die einmalige Startauswahl.
- src/features/dashboard/components/card-list.tsx als Renderkonsument.
- Jest und @testing-library/react-native für fokussierte Tests.

**Entscheidung:** Option A. Die bestehende verschlüsselte
Account-Query-Persistenz wird für den Präferenz-Snapshot erweitert. Ein
SQLite-Spiegel der Profilfelder gehört nicht zu diesem Bead. Eine spätere
Offline-Mutation kann diesen Architekturentscheid in einem eigenen Bead neu
bewerten.

## Commands

~~~bash
# Biome und Konventionsprüfungen
bun run check

# TypeScript ohne Ausgabe
bun run typecheck

# Fokussierte Tests für den betroffenen Read-/Persistenzpfad
bun run test -- src/features/settings/module-preferences.test.ts
bun run test -- src/lib/data/query-client.test.ts
bun run test -- src/features/dashboard/dashboard-screen.test.tsx
~~~

Eine Supabase-Migration, db:diff oder db:types ist nur erforderlich, wenn die
Planung entgegen dem aktuellen Befund das deklarative Backend-Schema ändert.

## Project Structure

~~~text
src/features/settings/module-preferences.ts
  Fachlicher Owner für Präferenztypen, Startauswahl, Read und Mutation.
src/lib/data/query-client.ts
  Accountgebundene Query-Persistenz und Netzwerkzustand.
src/lib/storage/local-account-storage.ts
  Verschlüsselter Account-Speicher.
src/features/dashboard/components/card-list.tsx
  Dashboard-Kartenfilterung und Rendern.
src/features/dashboard/dashboard-screen.test.tsx
  Dashboard-Verhalten und sichtbare Karten.
src/lib/data/query-client.test.ts
  Persistenzgrenzen und Wiederherstellung.
docs/specs/dashboard-offline-start/SPEC.md
  Diese fachliche Vereinbarung.
~~~

## Code Style und Zielmuster

Die Implementierung soll die bestehende Owner-Grenze erhalten. Das Dashboard
entscheidet nicht selbst über die Startauswahl:

~~~tsx
const { data: modules } = useModulePreferences(userId);

const visibleCards = allCards.filter(
  (card) => card.moduleKey === undefined || modules[card.moduleKey],
);
~~~

Die Hook-Garantie lautet, dass modules für einen aktiven Account aus dem
lokalen Snapshot oder aus der einmaligen Startauswahl stammt. Kein Konsument
darf diese fachliche Entscheidung mit einem eigenen Objekt oder einer zweiten
Fallback-Regel duplizieren.

Weitere Regeln:

- TypeScript-Inferenz und Narrowing statt neuer Umgehungs-Casts.
- Keine neue allgemeine Cache-, Queue- oder Sync-Abstraktion für diesen
  Einzelfall.
- Accountdaten nie im unverschlüsselten gemeinsamen Gerätespeicher ablegen.
- Bestehende Unistyles- und Feature-Owner bleiben unverändert.
- Keine manuell verfassten Supabase-Migrationen.

## Testing Strategy

Tests prüfen beobachtbare Zustände und echte Owner-Grenzen:

1. Hook-Read offline: Der lokale Snapshot wird bei offline gesetztem
   onlineManager ohne Remote-Aufruf geliefert.
2. Startauswahl: Ohne Snapshot liefert der Hook die einmalig definierte
   Startauswahl; die Abfrage bleibt für den UI-Render nicht undefined.
3. Persistenz: Ein erfolgreicher settings/module-preferences-Snapshot wird
   im accountgebundenen Speicher gesichert und für denselben Account
   wiederhergestellt.
4. Account-Isolation: Ein anderer Account erhält keinen Snapshot des
   vorherigen Accounts.
5. Dashboard: Bei pausierter oder fehlender Remote-Abfrage rendert CardList
  mindestens die Startauswahl- oder Snapshot-Karten und nicht null.
6. Reconnect: Ein erfolgreicher Online-Refresh aktualisiert die
   Kartenfilterung; ein fehlgeschlagener Refresh löscht den letzten lokalen
   Zustand nicht.

Offline-Mutationen sind in diesem Bead nicht enthalten. Atomare lokale Writes,
Outbox-Einträge, Retry und Reverse-Verhalten gehören in den Folge-Bead.

## Boundaries

- **Immer:** den kleinsten bestehenden Owner verwenden; accountgebundene
  Persistenz verwenden; Offline- und Reconnect-Fälle fokussiert testen; den
  lokalen Snapshot bei Remote-Fehlern erhalten.
- **Vorher fragen:** Offline-Mutationen und Outbox-Synchronisierung in diesen
  Bead aufnehmen; den lokalen SQLite-Spiegel oder das Supabase-Schema ändern;
  neue Abhängigkeiten oder Native-Module einführen; Routing-Verhalten aus
  fam-ho6e verändern.
- **Niemals:** das Dashboard bei fehlender Remote-Antwort leer rendern; die
  Startauswahl in mehreren Feature-Komponenten duplizieren; Accountdaten im
  gemeinsamen unverschlüsselten Gerätespeicher ablegen; Tests abschwächen oder
  Remote-Fehler als fehlenden Haushalt behandeln.

## Success Criteria

- Ein authentifizierter Nutzer mit lokal bekanntem Haushalt sieht das
  Dashboard im Flugmodus nach dem App-Start.
- Die Karten entsprechen dem zuletzt lokal gespeicherten Präferenz-Snapshot.
- Ohne Snapshot erscheinen die Karten der einmalig definierten Startauswahl
  statt einer leeren Dashboard-Fläche.
- Kein Remote-Request ist Voraussetzung für den ersten sichtbaren
  Dashboard-Render.
- Online-Reconnect aktualisiert die Karten auf den Remote-Zustand.
- Ein fehlgeschlagener Refresh löscht weder Snapshot noch Karten.
- Accountwechsel und Logout verhindern Datenübernahme zwischen Accounts.
- Die fokussierten Tests sowie bun run check und bun run typecheck sind
  erfolgreich.

## Annahmen

1. Session, Account-Bootstrap und lokaler Haushalt werden durch den bestehenden
   Startpfad bzw. fam-ho6e bereitgestellt; diese Spec repariert nicht die
   Haushaltsentscheidung.
2. Die bestehenden profiles.module_* Spalten bleiben die Remote-Wahrheit.
3. Der bestehende verschlüsselte Account-Speicher kann für die lokale
   Query-Wiederherstellung verwendet werden, ohne einen zweiten unverbundenen
   Präferenz-Owner einzuführen.
4. Eine einmalig festgelegte Startauswahl wird beim ersten Account-Setup
   gespeichert und ist der Fallback, wenn noch kein späterer lokaler Snapshot
   vorhanden ist.

## Open Questions

1. **Entschieden:** Offline-Änderungen und spätere Outbox-Synchronisierung
   folgen in einem eigenen Bead.
2. **Entschieden:** Die lokale Quelle läuft über die bestehende verschlüsselte
   Query-Persistenz; ein SQLite-Spiegel ist nicht Teil dieses Beads.
3. **Entschieden:** Die einmalig definierte Startauswahl besteht aus Vorrat,
   Einkaufsliste und Essensplaner. Rezepte und Kalorientracking starten nicht
   aktiv.

## Review Gate

Diese Spec ist erst nach Maintainer-Bestätigung für Plan, Tasks oder
Implementierung freigegeben. Die verbleibende Fallback-Entscheidung sowie die
Account- und Persistenzgrenze müssen beantwortet sein.
