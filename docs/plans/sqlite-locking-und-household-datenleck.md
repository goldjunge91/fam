# Untersuchung: "database is locked" + Haushalts-Datenleck nach Account-Wechsel

> **Nachtrag — dieses Dokument ist in Teilen ueberholt.**
> Die hier als *STARKE HYPOTHESE* und *UNGEKLAERT* markierten Stellen sind
> inzwischen aufgeloest, zwei davon **anders als hier vermutet**:
>
> - Befund 1: `withExclusiveTransactionAsync` faehrt kein `BEGIN EXCLUSIVE` auf
>   derselben Connection, sondern ein deferred `BEGIN` auf einer **neuen**
>   Connection. Der vorgeschlagene `busy_timeout`-Einzeiler haette deshalb
>   nicht gegriffen.
> - Befund 2: Ursache ist nicht "Kandidat 1" (In-Flight-Refetch), sondern dass
>   `queryClient.clear()` gemountete Observer nicht benachrichtigt.
> - Die Schlussfolgerung "Bug 1 und Bug 2 sind unabhaengig" stimmt in einer
>   Richtung nicht.
>
> Korrigierte Diagnose, Belege und die inzwischen umgesetzte Loesung:
> **`docs/plans/fix-sqlite-locking-und-household-datenleck.md`**.

## Kontext

Aufgetreten waehrend der manuellen Zwei-Geraete-Sync-Verifikation
(`tasks/fam-backlog/002-sync-engine-realtime-wiring.md` /
`003-gate-d-two-device-verification.md`) auf einem iOS-Simulator: nach einem
Logout + Login als anderer Nutzer + Erstellen eines neuen Haushalts zeigte
die App wiederholt `SQLiteErrorException: Error code 5: database is locked`
(`finalizeAsync` schlaegt fehl), und Einstellungen/Sync-Diagnose zeigten
weiterhin den Haushalt des *vorigen* Nutzers an. Zwei separate Bugs wurden
dabei identifiziert — sie teilen sich nur das Symptom-Vokabular
("database is locked"), nicht die Ursache. Beide muessen unabhaengig
behoben werden.

Konfidenz-Kennzeichnung in diesem Dokument:
- **BESTAETIGT** — per Code-Lesen/Grep direkt verifiziert
- **STARKE HYPOTHESE** — Mechanismus passt exakt zum beobachteten Symptom,
  Code-Belege vorhanden, aber nicht durch einen gezielten Reproduktionstest
  isoliert
- **UNGEKLAERT** — empirisch beobachtet, Ursache nicht vollstaendig
  zurueckverfolgt

---

## Befund 1: Fehlender `PRAGMA busy_timeout` → SQLITE_BUSY-Abstuerze

### Symptom

Wiederholte Absturz-Logs waehrend laufendem Betrieb (**kein** Cold Start
noetig):

```
SQLiteErrorException: Error code 5: database is locked
  (at ExpoSQLite/SQLiteModule.swift:471)
FunctionCallException: Calling the 'finalizeAsync' function has failed

[Error: Uncaught (in promise, id: 3) Error: FunctionCallException: Calling the 'finalizeAsync' function has failed (at ExpoModulesCore/AsyncFunctionDefinition.swift:123)
→ Caused by: SQLiteErrorException: Error code 5: database is locked (at ExpoSQLite/SQLiteModule.swift:471)] Uncaught (in promise, id: 3) Error: FunctionCallException: Calling the 'finalizeAsync' function has failed (at ExpoModulesCore/AsyncFunctionDefinition.swift:123)
→ Caused by: SQLiteErrorException: Error code 5: database is locked (at ExpoSQLite/SQLiteModule.swift:471)
```

### Code-Belege (BESTAETIGT)

`src/lib/db/client.ts:76` setzt beim Oeffnen nur:
```ts
await db.execAsync('PRAGMA journal_mode = WAL');
```
Kein `PRAGMA busy_timeout` irgendwo im Modul — per Grep ueber `src/lib`
bestaetigt leer.

Fuenf Stellen fuehren `withExclusiveTransactionAsync` aus (also `BEGIN
EXCLUSIVE`) auf derselben Connection:

| Datei                      | Zeile | Zweck                        |
| -------------------------- | ----- | ---------------------------- |
| `src/lib/db/outbox.ts`     | 70    | Mutation in Outbox schreiben |
| `src/lib/db/migrator.ts`   | 81    | Migrationen                  |
| `src/lib/sync/push.ts`     | 280   | Sync-Push                    |
| `src/lib/sync/pull.ts`     | 102   | Sync-Pull                    |
| `src/lib/sync/realtime.ts` | 150   | Realtime-Zeile anwenden      |

Zusaetzlich pollt `src/hooks/use-sync-status.ts:38-44` alle 3 Sekunden mit
einer eigenen `getFirstAsync`-Leseabfrage auf `outbox` — unabhaengig von
jeder der obigen Schreib-Transaktionen.

### Mechanismus (STARKE HYPOTHESE)

SQLites Standard-`busy_timeout` ist **0 ms**. Trifft eine der fuenf
`EXCLUSIVE`-Transaktionen zeitlich auf eine andere gleichzeitige
Lese-/Schreiboperation auf derselben Connection (z. B. Push laeuft, waehrend
der 3-Sekunden-Poll aus `use-sync-status.ts` feuert, oder Realtime-Apply
kollidiert mit Outbox-Enqueue), schlaegt die zweite Operation **sofort** mit
`SQLITE_BUSY` (Code 5) fehl statt zu warten — exakt der beobachtete Fehler.
Das erklaert zwanglos, warum es waehrend durchgehendem Betrieb auftritt
(mehrere unabhaengige Trigger: Poll alle 20s, Realtime-Events, Outbox-Retry,
UI-Poll alle 3s) und keinen Login/Logout-Zyklus braucht.

**Nicht isoliert verifiziert:** Es wurde kein gezielter Reproduktionstest
gebaut (z. B. zwei parallele `withExclusiveTransactionAsync`-Aufrufe im
Integrationstest, die den Fehler provozieren). Die Korrelation zwischen
Code-Struktur und Fehlertext ist aber sehr eng.

### Vorgeschlagener Fix

Eine Zeile in `client.ts`, direkt nach `PRAGMA journal_mode = WAL`:
```ts
await db.execAsync('PRAGMA busy_timeout = 5000');
```
SQLite wartet dann bis zu 5s auf eine Sperre statt sofort abzubrechen.
Geringes Risiko, kein struktureller Eingriff.

**Alternative (nicht empfohlen als Ersteingriff):** Schreib-/Lesezugriffe
zusaetzlich ueber eine JS-seitige Mutex/Queue serialisieren. Deutlich
invasiver: mehr Code, mehr Testflaeche, und `busy_timeout` allein loest
vermutlich schon den Grossteil der Faelle, da die Kollisionen kurzlebig
sind (einzelne Statements, keine langen Transaktionen).

### Konfidenz: hoch (Fix), Ursache selbst noch nicht isoliert reproduziert.

---

## Befund 2: `ensureDatabaseBelongsTo` nie verdrahtet → Cross-Account-Datenleck

### Symptom (empirisch reproduziert in dieser Session)

Ablauf: eingeloggt als `maestro-e2e@example.com` (Alt-Session, Haushalt
`Mein Haushalt`, id `32a6d7ee-...`) → Abmelden → Onboarding neu durchlaufen
→ eingeloggt als `geraeta@example.com` → neuen Haushalt "Sung Tes Haushalt
t" erstellt.

Per direkter DB-Abfrage bestaetigt:
```
households: c604838d-...  "Sung Tes Haushalt t"  (NEU, korrekt fuer geraeta erstellt)
households: 32a6d7ee-...  "Mein Haushalt"          (ALT, gehoert maestro-e2e)
household_members: 32a6d7ee-... / maestro-e2e-user-id / admin   (ALT, unveraendert)
```
Trotzdem zeigte die App fuer den *neuen* Nutzer geraeta:
- Einstellungen → "Aktueller Haushalt": **Mein Haushalt** (das ALTE)
- Sync-Diagnose → "Aktueller Haushalt in DB": ebenfalls das ALTE, id
  `32a6d7ee-...`
- Outbox-Eintraege (Default-Kuehlschrank-Items aus dem Modul-Setup)
  versuchten `INSERT fridge_items` mit `household_id: 32a6d7ee-...` (dem
  ALTEN Haushalt) → serverseitig korrekt von RLS abgelehnt, da geraeta
  dort kein Mitglied ist: `new row violates row-level security policy for
  table "fridge_items"`
- Mitglieder-Screen zeigte keinen "+ Mitglied einladen"-Button (siehe
  Mechanismus unten)

RLS hat hier also **richtig** reagiert und den fehlerhaften Schreibzugriff
verhindert — der eigentliche Bug liegt davor: die App haette den neuen
Haushalt als aktiv erkennen muessen, tat es aber nicht.

### Code-Belege: die fehlende Verdrahtung (BESTAETIGT)

`ensureDatabaseBelongsTo(userId)` (`src/lib/db/client.ts:144-165`) ist
vollstaendig implementiert — liest `app_meta.user_id`, loescht+baut die
lokale DB neu auf bei Nutzerwechsel — hat aber **keinen einzigen
Aufrufer** im gesamten `src/`-Baum (per Grep bestaetigt: nur die
Definition selbst und ein Kommentar).

Der Kommentar in `src/features/auth/sign-out.ts:35-36` verraet die
urspruengliche Design-Absicht woertlich:

> "Ein Fehler hier darf den Logout nicht scheitern lassen... 
> `ensureDatabaseBelongsTo()` faengt den Rest beim naechsten Anmelden ab,
> indem es bei fremder user_id alles verwirft."

D. h. es war als **zweite Verteidigungslinie** gedacht, hinter dem
Best-Effort-Loeschen beim Logout (`deleteLocalDatabase()` in
`client.ts:114-134`, dessen Fehler nur per `console.warn` geloggt und in
`sign-out.ts:37-40` nochmal abgefangen werden — bewusst, damit ein
fehlgeschlagenes Aufraeumen den Logout selbst nicht blockiert). Diese
zweite Linie fehlt komplett.

`Abmelden`-Button bestaetigt verdrahtet: `settings-screen.tsx:82` ruft
tatsaechlich `signOutAndClearLocalData(queryClient)`.

### Mechanismus des beobachteten Symptoms — mehrere Kandidaten, NICHT vollstaendig aufgeloest

Die Anzeige "Aktueller Haushalt" in Settings/Sync-Diagnose kommt in beiden
Screens ueber `useActiveHousehold()` →
`src/features/household/active-household-provider.tsx` (BESTAETIGT per
Grep: `settings-screen.tsx:46-47`, `sync-debug-screen.tsx:49-50`).

`activeHousehold` wird dort so ermittelt:
```
selectedId ← AsyncStorage (@fam/active_household_id), NICHT beim
             Logout geloescht (siehe Befund 3)
households ← useHouseholds() [react-query, queryKey: ['households'],
             NICHT nutzerspezifisch parametrisiert — src/features/
             household/api.ts:10-23]
activeHousehold ← households.find(id === selectedId) ?? households[0]
```

Drei mögliche, sich nicht ausschliessende Erklaerungen fuer das
beobachtete Verhalten, in absteigender Plausibilitaet:

1. **UNGEKLAERT, aber am plausibelsten:** `signOutAndClearLocalData` ruft
   `queryClient.clear()` (`sign-out.ts:27`) — das sollte den
   `['households']`-Cache-Eintrag entfernen. `clear()` bricht aber
   **keine bereits laufenden Requests** ab. War zum Zeitpunkt des Logouts
   noch ein Refetch von `useHouseholds()` fuer den ALTEN Nutzer in Flug
   (z. B. durch React Querys eigenes Refetch-on-focus/-reconnect
   ausgeloest), koennte dessen Antwort **nach** `clear()` zurueckkommen
   und den frisch geleerten Cache unter demselben, nicht
   nutzer-gebundenen Query-Key (`['households']`) wieder mit den ALTEN
   Daten befuellen — genau bevor oder waehrend der neue Nutzer seine
   eigene erste Abfrage stellt. Nicht durch Netzwerk-Timing-Logs
   verifiziert.
2. Der `selectedId`-Fallback (`households[0]`) haette bei einer sauber
   nutzerspezifischen `households`-Liste den neuen Haushalt waehlen
   muessen (`geraeta` ist nur in `c604838d-...` Mitglied) — dass
   stattdessen der ALTE Haushalt angezeigt wurde, spricht GEGEN "nur die
   AsyncStorage-ID ist stale" als alleinige Erklaerung und FUER Kandidat 1
   (die `households`-Liste selbst muss zum Anzeigezeitpunkt die alten
   Daten enthalten haben).
3. Nicht auszuschliessen, aber nicht belegt: irgendein weiterer,
   in dieser Session nicht aufgefundener Codepfad haelt eine eigene
   Kopie/Cache des "aktiven Haushalts" (z. B. in lokalem SQLite
   `app_meta` oder `sync_state`), die ebenfalls nicht beim Logout
   zurueckgesetzt wird. **Nicht verifiziert** — `sync_state.ts` wurde in
   dieser Untersuchung nicht gelesen.

**Wichtig:** Egal welcher der drei Mechanismen zutrifft — die Behebung von
Befund 2 (siehe unten) macht das Problem strukturell irrelevant, weil sie
die lokale lokale lokale DB *und* den entscheidenden Nutzer-Kontext an
einer zentralen Stelle validiert, statt auf einzelne Caches zu vertrauen.
Trotzdem waere eine gezielte Nachverfolgung von Kandidat 1 (Network-Timing
beim Logout) sinnvoll, um sicherzugehen, dass `useHouseholds()` nicht noch
an einer anderen Stelle denselben Fehler reproduziert.

### Vorgeschlagener Fix — inkl. einer Luecke, die ich im ersten Entwurf selbst uebersehen habe

**Erster Entwurf (unzureichend):** `ensureDatabaseBelongsTo(userId)` per
`useEffect` in `AppLayoutContent` (`src/app/(app)/_layout.tsx`) aufrufen,
gated durch ein `isDbReady`-Flag, das `useSyncEngine`/`useRealtimeSync`
erst mit echter `householdId` versorgt, wenn die Pruefung durch ist (beide
Hooks haben bereits ein fruehes `if (!householdId) return;` in ihrem
Effekt — bestaetigt in `sync-runner.ts:77` und `:128` — das macht dieses
Gating fuer *diese beiden* Hooks tatsaechlich sicher).

**Warum das nicht reicht:** `SyncStatusBanner` sitzt im **Root-Layout**
(`src/app/_layout.tsx`), nicht in `(app)/_layout.tsx` — rendert also
global, unabhaengig vom Auth-/Onboarding-Status. Es ruft ueber
`useSyncStatus()` (`src/hooks/use-sync-status.ts:38`) `getDatabase()`
komplett eigenstaendig auf, sobald die App startet — ungated von jedem
Mechanismus, der nur innerhalb von `AppLayoutContent` sitzt. Ein
component-lokales Gate uebersieht diesen (und potenziell weitere,
kuenftige) Aufrufer strukturell.

**Robusterer Ansatz:** Die Nutzer-Identitaets-Pruefung in `getDatabase()`s
eigenen Singleton-Mechanismus verlegen, statt sie als separates,
Component-Baum-abhaengiges Gate zu bauen:

1. Neue Funktion `setActiveUserId(userId: string | null)` in `client.ts`,
   die den zuletzt bekannten Nutzer in einer Modul-Variable haelt.
2. `SessionProvider` (`session-provider.tsx`) ruft `setActiveUserId(...)`
   synchron bei jedem Auth-State-Wechsel auf — sowohl beim initialen
   `getSession()`-Resultat als auch in `onAuthStateChange` — **bevor**
   `setState(...)` React benachrichtigt und damit bevor irgendeine
   Komponente re-rendert und potenziell `getDatabase()` aufruft.
3. `getDatabase()` selbst prueft als Teil seines bestehenden
   `opening`-Promise-Mechanismus (der laut eigenem Kommentar in
   `client.ts:86-88` bereits parallele Oeffnungs-/Migrations-Laeufe
   serialisiert) zusaetzlich die Nutzer-Identitaet und fuehrt bei
   Abweichung Loeschen+Neuaufbau **innerhalb desselben Mutex** durch —
   sodass jeder Aufrufer (`SyncStatusBanner` eingeschlossen) automatisch
   auf denselben, bereits laufenden Check/Wipe wartet, statt daran vorbei
   parallel auf die (gerade geloeschte) Datei zuzugreifen.

Das ist der Punkt, an dem die vorherige, componentenlokale Planversion
(`isDbReady` in `AppLayoutContent`) durch diese zentralere Loesung ersetzt
werden sollte.

### Offene Fragen / noch zu klaeren vor Umsetzung

- Exaktes Timing-Verhalten von `queryClient.clear()` vs. In-Flight-Requests
  fuer `useHouseholds()` — Kandidat 1 oben ist nicht isoliert verifiziert.
- Ob `src/lib/db/sync-state.ts` eine eigene, ebenfalls nicht
  zurueckgesetzte Kopie des "aktiven Haushalts" haelt (nicht gelesen in
  dieser Untersuchung).
- Ob `getDatabase()`s Umbau (Punkt 3 oben) mit `migrator.ts`s bestehendem
  Locking-Kommentar ("zwei parallele Migrationslaeufe... enden in
  `database is locked`") sauber zusammenspielt, oder ob der bestehende
  `opening`-Mechanismus fuer den zusaetzlichen Wipe-Fall erweitert werden
  muss (vermutlich ja — noch nicht im Detail durchgespielt).

### Konfidenz: Bug selbst hoch (empirisch reproduziert + Code-Luecke
eindeutig), exakter Verbreitungsmechanismus des Anzeige-Symptoms mittel
(Kandidat 1 plausibel, nicht bewiesen), Fix-Architektur mittel (Grundidee
solide, Detailinteraktion mit `migrator.ts` noch zu pruefen).

---

## Befund 3 (klein, verwandt): `active-household-store` nicht beim Logout geleert

`src/features/household/active-household-store.ts` persistiert
`@fam/active_household_id` in AsyncStorage. `signOutAndClearLocalData`
loescht `deleteLocalDatabase()`, aber nicht diesen Key (BESTAETIGT per
Grep — kein `setStoredActiveHouseholdId`/`removeItem`-Aufruf in
`sign-out.ts`). Gleiche Kategorie Bug wie Befund 2, eigenstaendig und
billig zu beheben: `setStoredActiveHouseholdId(null)` in
`signOutAndClearLocalData()` ergaenzen.

---

## Zusammenfassung

| #   | Bug                                      | Symptom                                                            | Fix-Aufwand                                    | Status                                     |
| --- | ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| 1   | Fehlender `busy_timeout`                 | `SQLITE_BUSY`/"database is locked"-Abstuerze bei laufendem Betrieb | 1 Zeile                                        | Fix vorgeschlagen, nicht umgesetzt         |
| 2   | `ensureDatabaseBelongsTo` nie aufgerufen | Cross-Account-Datenleck nach Nutzerwechsel auf selbem Geraet       | Moderat (Session-Provider + `client.ts`-Umbau) | Fix-Architektur entworfen, nicht umgesetzt |
| 3   | `active-household-store` nicht geleert   | Verwandtes/kleineres Daten-Leck                                    | 1 Zeile                                        | Fix vorgeschlagen, nicht umgesetzt         |

Bug 1 und Bug 2 sind **unabhaengig voneinander** — beide muessen behoben
werden, keiner loest den anderen mit.

## Verifikationsplan (nach Umsetzung)

- Bug 1: gezielter Test mit zwei parallelen
  `withExclusiveTransactionAsync`-Aufrufen (bzw. einem Aufruf + einer
  parallelen `getFirstAsync`-Leseabfrage) gegen dieselbe Connection —
  vorher reproduzierbar mit `SQLITE_BUSY`, nachher nicht mehr.
- Bug 2/3: exakt der in diesem Dokument beschriebene manuelle Ablauf
  (User A einloggen, Daten anlegen, abmelden, User B einloggen, neuen
  Haushalt anlegen) — Settings/Sync-Diagnose muessen sofort den NEUEN
  Haushalt zeigen, keine `fridge_items`-RLS-Fehler in der Outbox.
- Bestehende Suiten weiterhin gruen: `realtime.integration.test.ts`,
  `reconnect.test.ts` (unveraendert von diesen Fixes betroffen, aber als
  Regressionsnetz mitlaufen lassen).
