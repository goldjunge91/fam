# Umsetzungsplan: "database is locked" + Haushalts-Datenleck

Grundlage: `docs/plans/sqlite-locking-und-household-datenleck.md` (Untersuchung).
Dieses Dokument korrigiert zwei zentrale Annahmen der Untersuchung und legt die
Umsetzung fest.

> **Status: umgesetzt.** Alle Schritte aus Teil C sind erledigt, bis auf die
> Verifikation am Geraet (Schritt 7) — die steht noch aus. Was beim Bauen von
> der Planung abwich, steht in **Teil F** am Ende.
>
> - `bun run test` → 34 Suites, 285 Tests gruen (Baseline: 30 / 268)
> - `bun run test:integration` → 12 Suites, 91 Tests gruen (Baseline: 89)
> - `bun run typecheck`, `bun run check` → sauber

**Baseline vor Beginn:** `bun run test` → 30 Suites, 268 Tests gruen.

---

## Teil A — Korrigierte Diagnose

Die Untersuchung hatte drei Punkte als "STARKE HYPOTHESE" bzw. "UNGEKLAERT"
markiert. Alle drei sind jetzt aufgeloest — zwei davon anders als vermutet.
Belege stammen aus dem installierten Quelltext (`expo-sqlite@57.0.1`,
`@tanstack/react-query@5.101.4`) und aus einem Messskript gegen die
installierte Query-Version.

### A1 — Befund 1: Der Mechanismus ist bestaetigt, der vorgeschlagene Fix greift zu kurz

Die Untersuchung nahm an, `withExclusiveTransactionAsync` fuehre
`BEGIN EXCLUSIVE` **auf derselben Connection** aus. Beides stimmt nicht:

`node_modules/expo-sqlite/build/SQLiteDatabase.js:155-175` und die
`Transaction`-Klasse bei `:558-566`:

```js
async withExclusiveTransactionAsync(task) {
  const transaction = await Transaction.createAsync(this);   // NEUE Connection
  try {
    await transaction.execAsync('BEGIN');                    // DEFERRED, nicht EXCLUSIVE
    await task(transaction);
    await transaction.execAsync('COMMIT');
  } catch (e) { await transaction.execAsync('ROLLBACK'); error = e; }
  finally { await transaction.closeAsync(); }
}

class Transaction extends SQLiteDatabase {
  static async createAsync(db) {
    const options = { ...db.options, useNewConnection: true };   // <—
    ...
  }
}
```

Daraus folgen drei Dinge, die den vorgeschlagenen Einzeiler entwerten:

1. **Es gibt echte Mehr-Connection-Konkurrenz.** Jede der fuenf
   Transaktionsstellen oeffnet eine eigene native Connection. In WAL darf
   genau ein Schreiber gleichzeitig aktiv sein — connection-uebergreifend.
   Die Kollision ist damit keine Vermutung mehr, sondern strukturell angelegt.

2. **`PRAGMA busy_timeout` ist Connection-Zustand und wird nicht in der Datei
   gespeichert.** Anders als `journal_mode = WAL`, das im Datei-Header steht
   und deshalb von jeder neuen Connection uebernommen wird. Ein
   `busy_timeout` in `open()` (`client.ts:76 ff.`) erreicht damit **nur die
   Haupt-Connection**; jede Transaktions-Connection startet weiterhin mit
   `busy_timeout = 0`. Der vorgeschlagene Einzeiler haette also genau die
   Stellen nicht abgedeckt, an denen geschrieben wird.

3. **`busy_timeout` allein kann den hier vorliegenden Fall ohnehin nicht
   loesen.** Die Transaktionen lesen erst und schreiben dann in derselben
   deferred Transaktion — `applyRemoteRow` liest bei
   `src/lib/sync/mirror-write.ts:99` (`getFirstAsync`) und schreibt danach bei
   `:66`. Das ist der klassische Upgrade von Read- auf Write-Transaktion. Hat
   in der Zwischenzeit eine andere Connection geschrieben, liefert SQLite
   `SQLITE_BUSY_SNAPSHOT`, und ein Busy-Handler wird dabei bewusst **nicht**
   aufgerufen (er koennte den Deadlock nicht aufloesen, nur verlaengern). Die
   SQLite-Doku nennt genau eine Abhilfe:

   > To avoid encountering SQLITE_BUSY errors in the middle of a transaction,
   > the application can use **BEGIN IMMEDIATE** instead of just BEGIN […] if
   > it succeeds, then SQLite guarantees that no subsequent operations on the
   > same database through the next COMMIT will return SQLITE_BUSY.

#### Warum die Meldung `finalizeAsync` nennt (Irrefuehrung im Log)

`SQLiteDatabase.js:315-324` (identisch in `getFirstAsync`, `getAllAsync`):

```js
try   { result = await statement.executeAsync(...params); }
finally { await statement.finalizeAsync(); }
```

`sqlite3_finalize()` gibt den Fehlercode des letzten `step()` zurueck. Nach
einem Busy-Step wirft deshalb **auch** das `finalizeAsync()` im `finally` — und
weil es im `finally` liegt, **ersetzt** seine Rejection die urspruengliche. Was
im Log als "FunctionCallException: Calling the 'finalizeAsync' function has
failed" mit `id: 3` als Uncaught Promise ankommt, ist in Wahrheit ein
`SQLITE_BUSY` beim Ausfuehren.

Gegenprobe am Stacktrace: die Fehlermeldung nennt `SQLiteModule.swift:471`.
Genau dort steht in `node_modules/expo-sqlite/ios/SQLiteModule.swift` das
`throw SQLiteErrorException(...)` innerhalb von `private func finalize(...)`
(Zeile 470 ist das `if exsqlite3_finalize(...) != SQLITE_OK`). Die Zuordnung
ist damit exakt, nicht nur plausibel.

#### Warum die Testsuite das nie gesehen hat

`test/node-sqlite-adapter.ts:68` erfuellt denselben Port mit

```ts
db.exec('BEGIN IMMEDIATE');   // eine einzige Connection
```

mit dem Kommentar "entspricht dem Verhalten, das der Port zusichert". Der
Testadapter implementiert also genau die Semantik, die den Fehler **nicht**
erzeugen kann, waehrend der Produktionsadapter (`client.ts:60-61`, Delegation
an `expo-sqlite`) eine andere hat. 268 gruene Tests und ein reproduzierbarer
Geraetefehler sind kein Widerspruch — sie messen verschiedene Semantiken.

**Das ist der eigentliche Defekt: Produktionsadapter und Port-Zusicherung
weichen voneinander ab.** Der Fix besteht darin, die Zusicherung herzustellen.

### A2 — Befund 2: Der Verbreitungsmechanismus ist gemessen, nicht Kandidat 1

Die Untersuchung hielt einen In-Flight-Refetch fuer die plausibelste
Erklaerung ("Kandidat 1", nicht verifiziert). Gemessen gegen die installierte
`@tanstack/react-query@5.101.4` ist die Ursache einfacher und deterministisch:

```
1) initial (User A):                                        ["ALT"]
2) nach clear() + invalidate + refetch, OHNE Re-Render:     ["ALT"]
   Queries im Cache: 0
3) mit resetQueries() statt clear(), OHNE Re-Render:        ["NEU"]
4) nutzerspezifischer Key, Observer B:                      ["NEU"]
```

- **`queryClient.clear()` benachrichtigt gemountete Observer nicht.** Der
  Observer behaelt das Ergebnisobjekt des alten Nutzers, und es gibt kein
  Ereignis, das ein Re-Render ausloest.
- **Danach greift keine Invalidierung mehr.** `clear()` entfernt die Query aus
  dem Cache; `invalidateQueries({queryKey:['households']})` und
  `refetchQueries(...)` — genau das, was `useCreateHouseholdMutation.onSuccess`
  (`api.ts:37-40`) tut — finden **null** passende Queries. Der Observer ist
  verwaist.

Es fehlt also nur noch der Grund, warum der Observer nie neu anbindet. Der
steht in `src/app/_layout.tsx:150-152`:

```tsx
<QueryClientProvider client={queryClient}>
  <SessionProvider>              {/* haelt den Session-State */}
    <ActiveHouseholdProvider>    {/* kommt als `children`-Element herein */}
```

`ActiveHouseholdProvider` wird von `RootLayout` erzeugt und als `children` an
`SessionProvider` durchgereicht. Aendert sich der Session-State, rendert nur
`SessionProvider` neu; sein `children`-Prop ist dasselbe Element-Objekt wie
zuvor, React bricht die Rekonziliation dort ab. Und
`ActiveHouseholdProvider` konsumiert den `SessionContext` nicht — es bekommt
die Aenderung also auch nicht ueber den Context. **Er rendert bei An- und
Abmeldung nie neu**, ruft nie `observer.setOptions()` auf und bleibt dauerhaft
an die zerstoerte Query des Vornutzers gebunden.

Damit ist jedes beobachtete Detail erklaert, ohne Timing-Annahme:

| Beobachtung | Erklaerung |
| --- | --- |
| Settings/Sync-Diagnose zeigen den ALTEN Haushalt | Beide lesen `activeHousehold` aus dem verwaisten Observer (`settings-screen.tsx:46-47`, `sync-debug-screen.tsx:49-50`) |
| Neuen Haushalt anlegen half nicht | `invalidateQueries` traf 0 Queries im geleerten Cache |
| Outbox schrieb `household_id: 32a6d7ee-…` | `useSyncEngine(activeHouseholdId)` bekam die alte Id aus demselben Observer |
| Serverseitige RLS-Ablehnung | korrekt und erwuenscht — siehe unten |

**Kein Serverleck.** `supabase/schemas/03_households.sql:161`:
`households_select_member … using ((select private.is_household_member(id)))`.
Die Policy ist richtig; sie hat den Fehlschreibversuch korrekt abgewiesen. Der
Defekt ist ausschliesslich clientseitig.

**Kandidat 3 der Untersuchung ist ausgeraeumt.** `src/lib/db/sync-state.ts`
wurde jetzt gelesen: es haelt keine Kopie des aktiven Haushalts, nur Cursor je
`(entity, scope)`. *Nebenbefund, nicht Teil dieses Plans:* `scope` ist ueberall
der Default `'default'` statt der `household_id`, der Pull-Cursor ist also
haushaltsuebergreifend geteilt. Beim Haushaltswechsel ohne DB-Wipe kann das zu
uebersprungenen Zeilen fuehren. Getrennt als Issue erfassen.

### A3 — Korrektur: Befund 1 und 2 sind **nicht** unabhaengig

Die Untersuchung schliesst mit "Bug 1 und Bug 2 sind unabhaengig voneinander".
In einer Richtung stimmt das nicht — Bug 1 erzeugt die lokale Haelfte von Bug 2:

`node_modules/expo-sqlite/ios/SQLiteModule.swift:510-513`

```swift
private func deleteDatabase(databasePath: String) throws {
  if findCachedDatabase(where: { $0.databasePath == databasePath }) != nil {
    throw DeleteDatabaseException(databasePath)   // "…currently open. Close it prior to deletion"
  }
```

Jede offene Connection auf die Datei — auch eine haengengebliebene
Transaktions-Connection — laesst `deleteDatabaseAsync()` scheitern. In
`deleteLocalDatabase()` (`client.ts:114-134`) werden sowohl der
`closeAsync()`- als auch der `deleteDatabaseAsync()`-Fehler nur per
`console.warn` protokolliert, und `sign-out.ts:37-41` faengt den Rest nochmals
ab. Ergebnis: Bei Sperrproblemen ueberlebt die SQLite-Datei des Vornutzers den
Logout **stillschweigend** — und `ensureDatabaseBelongsTo()`, die dafuer
vorgesehene zweite Verteidigungslinie, wird nie aufgerufen.

Beide Fixes bleiben noetig; die Reihenfolge ist aber nicht beliebig: Fix 1
zuerst, sonst bleibt das Aufraeumen in Fix 2 unzuverlaessig.

---

## Teil B — Die Loesung

### Fix 1 — DB-Schicht: eine Connection, `BEGIN IMMEDIATE`, serialisiert

Ziel: Der Produktionsadapter erfuellt die Semantik, die der Port zusichert und
die der Testadapter bereits implementiert.

1. **`PRAGMA busy_timeout = 5000`** in `open()`, direkt nach der
   WAL-Zeile (`client.ts:76`). Kein Ersatz fuer 2./3., sondern Netz fuer
   Connections, die wir nicht kontrollieren (die Devtools-Registrierung von
   `expo-sqlite` im Dev-Build, WAL-Checkpoints).

2. **Eigene Transaktionsimplementierung auf derselben Connection**, statt der
   Delegation an `db.withExclusiveTransactionAsync` in `toPort`
   (`client.ts:60-61`):
   `BEGIN IMMEDIATE` → `task(txnPort)` → `COMMIT`, im Fehlerfall `ROLLBACK`.
   Der `ROLLBACK` muss selbst abgesichert sein: scheitert schon das `BEGIN`,
   wirft `ROLLBACK` mit "cannot rollback - no transaction is active" und
   verdeckt den echten Fehler (denselben Fehler hat die
   `expo-sqlite`-Implementierung).

3. **Serialisierung ueber einen Promise-Mutex** um jeden Portaufruf der
   aeusseren Datenbank (`execAsync`, `runAsync`, `getAllAsync`,
   `getFirstAsync`, `withExclusiveTransactionAsync`). Ohne den koennte die
   3-Sekunden-Abfrage aus `use-sync-status.ts:38` mitten in unser
   `BEGIN IMMEDIATE … COMMIT`-Fenster geraten und — auf derselben Connection —
   ungewollt Teil der Transaktion werden.

4. **Reentranz:** Der an `task` uebergebene `txn`-Port nimmt den Mutex
   **nicht**, sonst Deadlock. Genau die Unterscheidung, die der Testadapter
   ueber `wrap(db, insideTransaction)` schon trifft. Verschachtelte
   Transaktionen werfen wie dort mit klarer Meldung.

*Deadlock-Risiko geprueft:* Alle 13 `enqueueMutation`-Aufrufstellen (fridge,
shopping-list, inventory) schreiben ausschliesslich ueber das an
`applyLocally(txn)` uebergebene Handle; keine ruft `getDatabase()` innerhalb
eines Transaktionskoerpers auf.

**Warum nicht die Alternative** (Transaktions-Connections behalten und dort
`busy_timeout` als erstes Statement setzen): kostet pro Transaktion ein
Connection-Open/Close, loest `SQLITE_BUSY_SNAPSHOT` nicht, und eine
haengengebliebene Connection blockiert `deleteDatabaseAsync()` dauerhaft
(A3). Die Untersuchung hatte den Mutex als "deutlich invasiver" verworfen —
das galt unter der Annahme *einer* Connection mit `BEGIN EXCLUSIVE`. Unter der
tatsaechlichen Semantik ist er der kleinere Eingriff.

**Testbarkeit — wichtige Konsequenz:** `client.ts` ist laut eigenem Kopfkommentar
bewusst nicht aus `index.ts` erreichbar und unter Jest nicht importierbar
(natives Modul). Mutex- und Transaktionslogik gehoeren deshalb in ein neues,
`expo-sqlite`-freies Modul (Vorschlag: `src/lib/db/serialize.ts`), das einen
rohen Treiber entgegennimmt und einen `SqlDatabase` zurueckgibt. `client.ts`
verdrahtet nur noch. Damit ist die Logik mit `test/node-sqlite-adapter.ts`
pruefbar.

### Fix 2 — Nutzeridentitaet zentral in `getDatabase()`

Der Ansatz aus der Untersuchung ist richtig; hier praezisiert:

1. Modulvariable `activeUserId` in `client.ts` plus
   `setActiveUserId(userId: string | null)`.
2. `SessionProvider` ruft `setActiveUserId(...)` **synchron vor** `setState`
   auf — in beiden Pfaden: im `Promise.all`-Ergebnis (`session-provider.tsx:62-71`)
   und in `onAuthStateChange` (`:77-83`).
3. `getDatabase()` vergleicht innerhalb seines bestehenden
   `opening`-Mutex (`client.ts:90-105`) eine Modulvariable
   `checkedForUserId` mit `activeUserId`. Bei Abweichung: Pruefung gegen
   `app_meta.user_id`, bei fremder Id Wipe + Neuaufbau — alles **innerhalb**
   desselben Promise, sodass jeder Aufrufer (auch der `SyncStatusBanner` aus
   dem Root-Layout) darauf wartet, statt daneben auf die geloeschte Datei
   zuzugreifen.
4. Ist `activeUserId` noch `null` (Session beim Start noch nicht gelesen),
   findet keine Pruefung statt. Folge: der `SyncStatusBanner` kann fuer den
   Bruchteil bis zum Session-Ergebnis eine Outbox-Zahl des Vornutzers zeigen.
   Bewusst akzeptiert — es ist eine Zahl, kein Inhalt, und dem Sync-Engine
   fehlt bis dahin ohnehin die `householdId`. Sobald die Session da ist,
   wipet der naechste `getDatabase()`-Aufruf.
5. `ensureDatabaseBelongsTo` bleibt als Implementierung erhalten und wird von
   dort aufgerufen — die Funktion war korrekt, ihr fehlte nur der Aufrufer.

Fix 1 ist Voraussetzung: Der Wipe muss die Connection sicher schliessen
koennen, und mit einer serialisierten Einzel-Connection ist genau das der Fall.

### Fix 3 — Query-Cache pro Nutzer schluesseln (die strukturelle Absicherung)

Das ist der Fix, der die Klasse von Fehlern beseitigt, nicht nur den Fall:

1. **`useHouseholds()` bekommt einen nutzerspezifischen Key**
   (`api.ts:10-23`): `enabled: !!userId` und ein Key, der die `userId`
   enthaelt. Wechselt der Nutzer, wechselt der Key — der Observer bindet an
   eine andere Query und kann die Daten des Vornutzers gar nicht mehr
   ausliefern (Messung 4 oben). `['households']` ist der einzige
   nutzerbezogene Key ohne Parameter; alle uebrigen sind bereits ueber
   `householdId` bzw. `userId` geschluesselt (`['profile', userId]`,
   `['fridge_items', householdId]`, …).

   **Zur Key-Wahl:** `['households', userId]` waere technisch kollisionsfrei —
   die Unterschluessel `['households', householdId, 'members'|'invites'|'children']`
   tragen an derselben Position eine Haushalts-, keine Nutzer-Id, eine
   Invalidierung von `['households', userId]` traefe sie also nicht. Der Slot
   haette dann aber je nach Query zwei verschiedene Bedeutungen, und ein
   vertauschtes Argument wuerde still denselben Cache-Eintrag teilen statt
   aufzufallen. Deshalb `['households', 'by-user', userId]` — eindeutig lesbar,
   ohne Verhaltensunterschied.

   Mitzuziehen sind die vier weiteren Aufrufstellen
   (`active-household-provider.tsx:21`, `onboarding/step-create-household.tsx:17`,
   `onboarding/components/complete-step.tsx:12`,
   `onboarding/components/household-step.tsx:23`) und die Invalidierungen auf
   `['households']` (`api.ts:38-39, 128, 145, 247-248`,
   `create-household-screen.tsx:31`).

2. **`ActiveHouseholdProvider` konsumiert `useSession()`.** Damit rendert er
   bei Auth-Wechseln neu (heute nicht — A2), und `selectedId` wird
   zurueckgesetzt, sobald sich `userId` aendert. Letzteres macht einen
   liegengebliebenen AsyncStorage-Key selbst dann harmlos, wenn das Aufraeumen
   beim Logout scheitert.

3. **`sign-out.ts:27`: `queryClient.clear()` → `await queryClient.resetQueries()`.**
   `resetQueries()` benachrichtigt die Observer und setzt sie auf den
   Initialzustand zurueck (Messung 3). Zusammen mit `enabled: !!userId` aus
   Punkt 1 entstehen dabei keine Requests ohne Session — die Daten
   verschwinden schlicht.

### Fix 4 — Befund 3: AsyncStorage-Key beim Logout leeren

`setStoredActiveHouseholdId(null)` in `signOutAndClearLocalData()` ergaenzen —
und zwar so, dass es auch dann laeuft, wenn `deleteLocalDatabase()` vorher
geworfen hat (eigener `try`, nicht im selben Block). Mit Fix 3.2 ist es die
zweite Sicherung, nicht die einzige.

---

## Teil C — Umsetzungsschritte

Jeder Schritt ist fuer sich lauffaehig und testbar; nach jedem `bun run test`.

| # | Schritt | Dateien |
| --- | --- | --- |
| 1 | `serialize.ts`: Mutex + `BEGIN IMMEDIATE`-Transaktion + Reentranz + Nesting-Fehler, ueber rohem Treiber | neu `src/lib/db/serialize.ts` |
| 2 | `client.ts` verdrahten: `busy_timeout`, `toPort` ueber `serialize.ts`, keine Delegation an `withExclusiveTransactionAsync` mehr | `src/lib/db/client.ts` |
| 3 | Logout-Aufraeumen: `resetQueries()`, `setStoredActiveHouseholdId(null)` | `src/features/auth/sign-out.ts` |
| 4 | Nutzerschluessel: `useHouseholds()` + 4 Aufrufstellen + Invalidierungen | `src/features/household/api.ts` u. a. |
| 5 | `ActiveHouseholdProvider` konsumiert Session, `selectedId`-Reset bei Nutzerwechsel | `active-household-provider.tsx` |
| 6 | `setActiveUserId()` + Identitaetspruefung im `opening`-Mutex | `client.ts`, `session-provider.tsx` |
| 7 | Verifikation am Geraet | — |

Reihenfolge nicht tauschen: 1–2 vor 6 (A3), 4 vor 5 (der Provider braucht den
neuen Key).

---

## Teil D — Tests

**Neu, automatisiert:**

1. `serialize.test.ts` — zwei gleichzeitige `enqueueMutation`-Aufrufe duerfen
   sich nicht verschachteln (Statement-Reihenfolge ueber `countingDatabase`
   aus `test/node-sqlite-adapter.ts:106`).
2. `serialize.test.ts` — die Transaktion setzt `BEGIN IMMEDIATE` ab, nicht
   `BEGIN`; ein werfender Task fuehrt zu genau einem `ROLLBACK`; ein
   fehlgeschlagenes `BEGIN` verdeckt den Originalfehler nicht.
3. `serialize.test.ts` — verschachtelter Transaktionsaufruf wirft mit der
   erwarteten Meldung.
4. Semantik-Regression zu `SQLITE_BUSY`: zwei `node:sqlite`-Connections auf
   dieselbe Datei; deferred `BEGIN` + Read + Write gegen einen gehaltenen
   Schreiber liefert `SQLITE_BUSY`, `BEGIN IMMEDIATE` + `busy_timeout` nicht.
   Belegt die Diagnose aus A1 als ausfuehrbaren Test statt als Kommentar.
5. Identitaetspruefung (reine Funktion, ohne `expo-sqlite`): fremde
   `app_meta.user_id` → Wipe-Callback wird gerufen; gleiche Id → nicht;
   leere DB → nur Schreiben der Id.
6. `active-household-provider.test.tsx` — Rendern mit Session A, Wechsel auf
   Session B: `activeHousehold` stammt aus B, nie aus A. Das ist der
   Regressionstest fuer A2.

**Bestehend als Netz mitlaufen lassen:** `realtime.integration.test.ts`,
`reconnect.test.ts`, `outbox.integration.test.ts`, `migrator.test.ts`,
`push.integration.test.ts`, `pull.integration.test.ts`.

**Manuell am Simulator (Gate):** exakt der Ablauf aus der Untersuchung —
User A anmelden, Daten anlegen, abmelden, User B anmelden, neuen Haushalt
anlegen. Erwartet: Settings und Sync-Diagnose zeigen sofort den NEUEN
Haushalt; keine `fridge_items`-RLS-Fehler in der Outbox; kein
"database is locked" im Log waehrend eines laufenden Sync-Zyklus.

---

## Teil E — Risiken und offene Punkte

- **Serialisierung der gesamten DB-Arbeit.** Alle Zugriffe laufen jetzt
  nacheinander. Die Statements sind kurz (Zaehlabfragen, Einzelzeilen); der
  groesste Block ist eine Pull-Seite in einer Transaktion. Verzoegert das
  einmal die 3-Sekunden-Statusabfrage, aktualisiert das Banner drei Sekunden
  spaeter — nicht sichtbar. Sollte sich das messbar aendern, ist der naechste
  Schritt getrennte Lese-/Schreibpfade, nicht die Ruecknahme.
- **Hintergrund-Task.** `expo-task-manager` laeuft im selben JS-Kontext, teilt
  also denselben Mutex. Gewollt.
- **`busy_timeout = 5000`** ist gesetzt, weil die UI alle 3 s pollt — ein
  Wert darunter wuerde die Wartezeit sinnlos begrenzen.
- **Nebenbefund, separat erfassen:** `sync_state.scope` ist ueberall
  `'default'` statt der `household_id` (A2, Ende). Nicht Teil dieses Plans.
- Nach der Umsetzung sollte
  `docs/plans/sqlite-locking-und-household-datenleck.md` einen Verweis auf
  dieses Dokument bekommen, damit die dort als "STARKE HYPOTHESE" markierten
  Stellen nicht weiter als offen gelesen werden.

---

## Teil F — Was bei der Umsetzung abwich

Vier Abweichungen von Teil B/C, jeweils mit Grund:

1. **`useHouseholds()` holt die Nutzer-Id selbst** (ueber `useSession()`),
   statt sie als Parameter zu bekommen. Damit blieben die vier Aufrufstellen
   (`active-household-provider`, die drei Onboarding-Schritte) unveraendert —
   Schritt 4 wurde kleiner als geplant. Nebeneffekt, der Schritt 5 erleichtert:
   Weil `useHouseholds()` jetzt den `SessionContext` konsumiert, rendert der
   `ActiveHouseholdProvider` bei Auth-Wechseln ohnehin neu.

2. **Eigene Datei `src/lib/db/ownership.ts`** statt der Pruefung direkt in
   `client.ts`. Grund ist Teil B/Fix 1s eigene Feststellung: `client.ts` ist
   unter Jest nicht importierbar. Als eigene, `expo-sqlite`-freie Datei mit
   einem `wipeAndReopen`-Callback ist die Entscheidung ohne Geraet pruefbar.

3. **`closeAndDeleteFile()` von `deleteLocalDatabase()` abgespalten** — im Plan
   nicht vorgesehen, beim Bauen noetig geworden: Das bisherige
   `deleteLocalDatabase()` setzt `opening = null`. Aus `openAndVerify()` heraus
   aufgerufen haette es damit sein *eigenes* Oeffnungs-Promise abgemeldet, und
   ein zweiter Aufrufer haette daneben einen zweiten Oeffnungslauf gestartet —
   genau die Situation, gegen die der Mutex existiert.

4. **Eine Testsuite mehr als geplant**: `sqlite-locking.test.ts` prueft nicht
   Projektcode, sondern SQLite selbst (Teil D4). Sie steht dort, weil die
   urspruengliche Annahme "ein `busy_timeout` genuegt" plausibel klang und
   trotzdem falsch war; ohne ausfuehrbaren Beleg wandert sie beim naechsten
   Sperrproblem zurueck in den Code.

### Beide Regressionstests wurden gegengeprueft

Ein Test, der auch ohne den Fix gruen ist, belegt nichts. Deshalb je einmal
mit zurueckgedrehtem Fix laufen lassen:

- **Serialisierung:** ohne Mutex protokolliert derselbe Ablauf
  `["BEGIN IMMEDIATE", "BEGIN IMMEDIATE", "COMMIT"]` — die zweite Transaktion
  faellt in die erste, eine geht verloren. Mit Mutex zwei saubere Bloecke.
- **Nutzerschluessel:** mit `queryKey: ['households']` scheitern alle drei
  Faelle in `active-household-provider.test.tsx` mit "Unable to find an element
  with text: Haushalt von B" — also exakt dem gemeldeten Symptom: Der neue
  Nutzer sieht weiterhin den Haushalt des alten.

### Zusaetzlich behoben: Realtime-Channel-Kollision

Beim Gegentesten am Geraet trat ein Fehler auf, der nichts mit den drei
Befunden zu tun hat, aber dieselbe Ecke betrifft:

```
Uncaught (in promise) Error: cannot add `postgres_changes` callbacks for
realtime:household:<id> after `subscribe()`.
```

Ursache: `supabase.channel(topic)` legt **keinen** neuen Channel an, wenn zu
dem Topic schon einer registriert ist — es gibt die vorhandene Instanz zurueck
(`RealtimeClient.channel()`, realtime-js). Ist die bereits subscribt, wirft
`channel.on('postgres_changes', …)` genau diese Meldung
(`RealtimeChannel.on()` prueft `isJoined() || isJoining()`).

Stehen bleibt so eine Instanz, wenn das Modul mit der unsubscribe-Closure
ersetzt wird, der Supabase-Client aber weiterlebt — im Dev-Build bei jedem
Fast Refresh. Die Cleanup-Funktion des vorigen Laufs kommt dann nie zur
Ausfuehrung.

Fix in `subscribeHouseholdRealtime`: vor dem Anlegen einen bereits
registrierten Channel desselben Topics abraeumen. `removeChannel()` nimmt ihn
**synchron** aus der Registry (der `await` darin betrifft nur das Leave zum
Server) — nachgemessen, nicht angenommen —, deshalb genuegt fire-and-forget.

Zwei Zwischenschritte, die dabei verworfen wurden, weil die Messung sie
widerlegt hat: eine Verkettung der Teardowns in `sync-runner.ts` und die
Annahme, das nicht abgewartete `removeChannel()` sei die Ursache. Beides klang
plausibel, keines reproduzierte den Fehler. Geblieben ist neben dem Guard nur,
dass `unsubscribe()` jetzt `async` ist und das Leave abwartet — damit sind die
`setTimeout(300)`-Gnadenfristen in den Tests keine Voraussetzung mehr.

Regressionstest: `realtime.integration.test.ts` → "raeumt einen
stehengebliebenen Channel desselben Topics ab". Gegengeprueft — ohne den Guard
scheitert er mit exakt der oben zitierten Meldung.

### Offen

Nur Schritt 7, die manuelle Verifikation am Simulator (Ablauf in Teil D unten).
Sie ist die einzige Stelle, an der `expo-sqlite` selbst laeuft — alles bisher
Gepruefte lief gegen `node:sqlite`.

## Quellen

- [SQLITE_BUSY_SNAPSHOT / BEGIN IMMEDIATE — sqlite.org](https://www.sqlite.org/rescode.html#busy_snapshot)
- [SQLite User Forum: „Database is locked when upgrading from read to write"](https://sqlite.org/forum/info/c3cb9524bef62b67)
- Installierter Quelltext: `expo-sqlite@57.0.1`, `@tanstack/react-query@5.101.4`
