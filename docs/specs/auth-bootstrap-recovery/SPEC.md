# Spec: Auth-Bootstrap und sichere Account-Recovery

Status: Bereit zur Maintainer-Freigabe; noch nicht zur Implementierung freigegeben.

Bead: `fam-ya7p`

## Capability Map

Die gemeldeten Fehler gehören zu einer gemeinsamen Sicherheitsgrenze, sind aber
unabhängig testbar. Die Modul-IDs bleiben für spätere Aufgaben stabil.

| Module id | Verantwortung | Abhängigkeiten |
|---|---|---|
| `secure-storage-transaction` | Linearisierbare SecureStore-Operationen, journalisierter Chunk-Commit, Recovery verwaister Token-Fragmente und UTF-8-Byte-Limits | - |
| `session-bootstrap-authority` | Autoritativer Session-/Account-Zustand, INITIAL_SESSION-Reihenfolge, Account-Mismatch und fail-closed Fehlerzustände | `secure-storage-transaction` |
| `account-provider-gating` | Verhindert Datenbank-, Haushalts-, Sync-, RevenueCat- und PostHog-Aktivierung vor erfolgreichem Bootstrap | `session-bootstrap-authority` |
| `cleanup-and-observability` | Cleanup-Fehler, Promise-Rejections, pseudonyme Telemetrie und feingranulare Bootstrap-Stages | `session-bootstrap-authority` |
| `regression-contract` | Fokussierte Unit-, Provider-, Integrations- und Recovery-Tests für alle Crash-Punkte | alle vorherigen Module |

Build order: `secure-storage-transaction` → `session-bootstrap-authority` →
`account-provider-gating` → `cleanup-and-observability` →
`regression-contract`.

`cleanup-and-observability` kann testseitig parallel vorbereitet werden, wird
aber erst nach dem stabilen Session-Vertrag abgeschlossen. Es gibt keine
gegenseitige Abhängigkeit zwischen `account-provider-gating` und
`cleanup-and-observability`.

## Objective

Die App soll bei einem fehlerhaften lokalen Auth-/Account-Bootstrap sicher im
Retry-Fallback bleiben. Ein gültiger Supabase-Auth-Event darf einen fehlenden
lokalen Commit nicht in einen scheinbar aktiven Account verwandeln. Während
dieser Zeit dürfen weder fremde lokale Account-Daten gelesen oder beschrieben
noch Account-Identitäten an RevenueCat oder PostHog synchronisiert werden. Die
externen Produktidentitäten bleiben fachlich unverändert, dürfen aber erst nach
`accountReady` synchronisiert werden; Roh-User-IDs gehören nicht in Telemetrie,
Diagnose-Logs oder Fehler-Properties.

Der Scope umfasst die native SecureStore-Sessionablage, den SessionProvider,
die Account-Provider im App-Shell, den Orphan-Logout und die zugehörige
Telemetrie. Die Spezifikation verfolgt acht konkrete Fehlerklassen:

1. Read/Write-Race im chunkenden SecureStore-Adapter.
2. INITIAL_SESSION hebt einen fehlgeschlagenen lokalen Bootstrap auf.
3. Session allein aktiviert Account-Provider trotz Fehler-Fallback.
4. Abgebrochene Chunk-Writes hinterlassen Token-Fragmente.
5. Die Account-Mismatch-Bereinigung kann den neuen statt des alten Accounts löschen.
6. Ein abgelehntes Orphan-Logout-Promise wird verworfen.
7. Telemetrie enthält Roh-User-IDs oder zu grobe Bootstrap-Informationen.
8. Größenlimits werden in UTF-16-Zeichen statt UTF-8-Bytes gemessen.

Erfolg bedeutet nicht, dass jede Session wiederhergestellt wird. Erfolg
bedeutet, dass jede Entscheidung sicher und beobachtbar ist: entweder ist ein
Account vollständig aktiviert oder der Zustand bleibt fail-closed und kann
explizit erneut versucht werden.

## Current Evidence and Context Pack

Die folgenden Quellen wurden vor dem Spec geladen und sind die fokussierte
Arbeitsgrundlage für eine spätere Implementierung:

- `src/lib/storage/chunked-storage.ts`: `getItem()` liest aktuell außerhalb der
  per-Key-Write-Queue. Der v2-Header wird zwar erst nach den Chunks geschrieben,
  aber nicht referenzierte Ziel-Chunks haben keine dauerhafte Recovery-Markierung.
- `src/lib/storage/chunked-storage.test.ts`: deckt Commit-Verlust und parallele
  Writes ab, aber nicht die Read/Write-Interleaving-Fälle, neue Adapterinstanzen
  nach einem Abbruch oder UTF-8-Byte-Grenzen mit realistischem Store-Limit.
- `src/features/auth/session-provider.tsx`: `currentUserId` wird vor
  `startAccountQueryPersistence()` gesetzt. Die `initialization`-Kette fängt den
  Fehler ab und ein folgendes Auth-Event kann danach den Fehlerstatus löschen.
- `src/features/navigation/root-navigator.tsx`: der OFF-/Datenbank-Bootstrap
  prüft nur `session?.user.id`.
- `src/features/app-shell/app-providers.tsx` und
  `src/features/app-shell/app-providers.android.tsx`: ActiveHouseholdProvider,
  PremiumProvider und PostHogIdentitySync werden unter einer reinen
  SessionProvider-Hierarchie gemountet.
- `src/lib/storage/account-storage.ts` und `src/features/auth/sign-out.ts`:
  Account-Cleanup ist grundsätzlich fail-closed, aber Cleanup-Fehler müssen an
  allen Aufrufstellen explizit behandelt werden.
- `src/features/profile/hooks/use-sign-out-on-orphaned-profile.ts`: startet
  `signOutAndClearLocalData()` per `void`, ohne Rejection-Handler.
- `src/lib/telemetry/index.ts`: hängt `activeUserId` als `user_id` an
  Telemetrie-Properties; vorhandene Tests erwarten derzeit die Roh-ID und müssen
  auf den neuen Datenschutzvertrag umgestellt werden.

## Contract

### 1. Zustandsmodell

`session` und `accountReady` sind unterschiedliche Tatsachen:

- `session`: Supabase kennt eine Session oder einen Auth-Event-Snapshot.
- `accountReady`: lokaler Account-Speicher, Legacy-Migration,
  Query-Persistenz, Ownership und Sync-Gate sind erfolgreich committed.
- `error`: ein Bootstrap- oder Cleanup-Fehler verhindert weitere Account-Aktivierung.
- `isLoading`: ein Bootstrap- oder Accountwechsel befindet sich noch vor dem
  sichtbaren Zustand.

Ein nichtleerer `session`-Wert darf bei einem lokalen Fehler für den Retry- und
Diagnosekontext erhalten bleiben. Er ist dann ausdrücklich kein
Berechtigungssignal für Account-Provider. `accountReady` ist das einzige
Aktivierungssignal für React-/Provider-Side-Effects; Low-Level-Account-APIs
benötigen zusätzlich den generationsgebundenen `capability`-Token.

Beispiel für die gewünschte Semantik, nicht für eine vorgeschriebene konkrete
Implementierung:

```ts
type SessionState = {
  session: Session | null;
  accountReady: boolean;
  capability: AccountCapability | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
};

const canUseAccountRuntime =
  state.accountReady && state.capability !== null && state.error === null;
```

`accountReady` bleibt ein UI-/Provider-Signal. Niedrige APIs autorisieren sich
nie nur über dieses Boolean, sondern über `capability`.

### 2. SecureStore-Transaktion

Für jeden Storage-Key werden `getItem`, `setItem` und `removeItem` über eine
gemeinsame Operation-Queue linearisiert. Die Queue wird pro physischem
`KeyValueStore` und physischem Schlüssel geteilt, damit auch mehrere Adapter-
Instanzen über denselben Store nicht gegeneinander schreiben. Die
Produktionsarchitektur verwendet weiterhin genau eine Adapterinstanz pro
Supabase-Client; mehrere JavaScript-Runtimes oder getrennte native Store-
Wrapper sind ausdrücklich nicht durch diese In-Process-Queue abgesichert.

Der Adapter bleibt strukturell als `KeyValueStore` verwendbar, erweitert den
Rückgabevertrag aber um `recoverKey(logicalKey): Promise<void>`. Nur diese
explizite Recovery-Operation darf einen `StorageRecoveryError`-gesperrten Key
erneut untersuchen.

Neue Writes verwenden immer den v3-Stagingpfad, auch bei kleinen Werten. Die
direkte Header-Überschreibung sowie v1/v2-Header bleiben nur als Legacy-
Lesepfad für bestehende Werte erhalten. Der v3-Header enthält Slot, Chunkzahl,
UTF-8-Byte-Länge und einen SHA-256-Digest der rekonstruierbaren Nutzlast.
Logische Schlüssel werden kollisionsfrei in einen reservierten, nativen
Schlüssel-Namensraum kodiert; rohe logische Schlüssel dürfen nicht als Chunk-
Key dienen.

Der v3-Pending-Marker ist ein dauerhaft lesbares, strukturiertes Journal mit
`operationId`, `previousHeader`, `targetSlot`, `chunkCount`, `byteLength`,
`payloadDigest` und `phase`. Der v3-Header trägt dieselben
Integritätsmetadaten, damit fehlende, gekürzte oder manipulierte Chunks nicht
als gültiger Secret-Wert rekonstruiert werden. Der SHA-256-Digest erkennt
Korruption und unvollständige Writes, ist aber keine zusätzliche Authentizität
gegen einen kompromittierten nativen Store. Der feste Ablauf lautet:

1. Pending-Marker für den Zielslot schreiben.
2. Neue Chunks vollständig schreiben.
3. Neuen Header als Commit schreiben.
4. Alte, nicht mehr referenzierte Chunks bereinigen.
5. Pending-Marker erst nach erfolgreichem Cleanup entfernen.

Der Storage-Zustandsautomat wertet Journal und Header in dieser Reihenfolge
aus:

| Journal/Header-Zustand | Autoritative Aktion |
|---|---|
| Journal-Lesen rejectet oder Journal ist malformed | `StorageRecoveryError`, keine Löschung und kein Secret-Read; nur explizites `recoverKey()` darf erneut versuchen |
| Kein Journal, gültiger v3-Header | Header-Digest validieren, Wert liefern; inaktiven Slot begrenzt bereinigen |
| Kein Journal, gültiger v3-Tombstone | Beide Slots dieses Keys begrenzt bereinigen, `null` liefern |
| Kein Journal, gültiger v1/v2-Header | Legacy-Wert liefern; v3-Rewrite ist für die nächste erfolgreiche Mutation vorgesehen |
| Kein Journal, kein Header | Zwei Slots bis `MAX_CHUNK_COUNT` begrenzt bereinigen, `null` liefern |
| `prepared`/`chunks_written`, Header entspricht `previousHeader` oder ist absent | Zielslot begrenzt löschen, Journal entfernen, vorherigen Wert liefern |
| `prepared`/`chunks_written`, Header entspricht Target und Digest | Phase auf `cleanup_pending` fortschreiben, alten Slot bereinigen, Target liefern |
| `cleanup_pending`, Target-Header und Digest gültig | Alten Slot erneut begrenzt bereinigen, Journal erst danach entfernen, Target liefern |
| `remove_committed`, Tombstone gültig | Alten Slot erneut bereinigen, Tombstone liefern als `null`, Journal zuletzt entfernen |
| Jede andere Kombination oder Digest-/Längenfehler | `StorageRecoveryError`, nichts löschen und kein Secret-Read |

Ein `StorageRecoveryError` ist der gesperrte API-Zustand. `getItem`, `setItem`
und `removeItem` führen vor ihrer eigentlichen Operation denselben Recovery-
Schritt aus; solange er nicht eindeutig abgeschlossen ist, propagieren sie den
Fehler. `recoverKey()` ist die einzige explizite Wiederaufnahme und darf nur
die für diesen Key bekannten zwei Slots, das Journal und die Header prüfen.
So ist der gesperrte Zustand nicht zirkulär und ein normaler Read gibt kein
Secret aus, während der Store unklar ist.

`removeItem()` verwendet denselben v3-Stagingpfad: zuerst wird ein Tombstone
als Commit geschrieben, danach werden alte Chunks bereinigt und erst am Ende
Tombstone und Journal entfernt. So kann ein abgebrochenes Entfernen keinen
alten Header auf bereits gelöschte Chunks zeigen lassen.

Die Expo-SecureStore-API dokumentiert keine Transaktions- oder Partial-Write-
Garantie. Ein natives Promise-Reject nach einem möglichen Teil-Write ist daher
ein unbekannter Commit-Zustand. Der Adapter meldet den Write als fehlgeschlagen,
liest bei der Recovery Journal und Header, akzeptiert nur einen eindeutig
referenzierten Wert und liefert bei einem unauflösbaren Zustand keinen Secret-
Wert aus. Er darf in diesem Zustand weder den alten noch den neuen Wert als
sicher ausgeben.

Recovery-Invarianten:

- Vor einem eindeutig erfolgreichen Header-Commit bleibt der alte Wert
  vollständig lesbar; bei unbekanntem Commit wird fail-closed gelesen.
- Nach einem eindeutig erfolgreichen Header-Commit und erfolgreicher
  Integritätsprüfung ist der neue Wert autoritativ, auch wenn nachgelagerte
  Bereinigung zunächst fehlschlägt.
- Ein abgebrochener Write wird nicht als erfolgreicher Write gemeldet.
- Ein Cleanup-Fehler lässt das Journal erhalten; die nächste Operation auf
  diesem Key wiederholt nur die im Journal beschriebene, begrenzte Bereinigung.
- Recovery löscht niemals Chunks des aktuell eindeutig referenzierten Headers.
- Es gibt keinen ungebundenen Sweep über alle logischen Keys. Wenn ein Journal
  fehlt, darf der Adapter für den angeforderten logischen Key einen begrenzten
  Sweep über die zwei bekannten Slots und höchstens `MAX_CHUNK_COUNT` Indizes
  durchführen: Bei gültigem Header wird nur der inaktive Slot bereinigt; ohne
  gültigen Header dürfen beide Slots bereinigt werden. Ist das Journal selbst
  fehlerhaft oder nicht lesbar, bleibt der Schlüssel gesperrt und es wird
  nichts gelöscht.
- Die Produktionsinstanz ruft `recoverKey()` für ihren bekannten Supabase-
  Auth-Key beim Client-Start und vor dem ersten Auth-Zugriff auf. So werden
  Fragmente auch dann gefunden, wenn ein Marker-Write zwar aufgelöst wurde,
  aber vor dem Prozessneustart nicht dauerhaft war.
- v1/v2-Legacy-Header bleiben lesbar und werden erst nach einem erfolgreichen
  neuen v3-Commit bereinigt.
- Eine neue `createChunkedStorage()`-Instanz kann einen persistenten Store nach
  einem Prozessneustart anhand des Journals sicher fortsetzen, ohne einen
  gültigen referenzierten Header zu löschen.

### 3. Byte-Limits

Alle Größenlimits beziehen sich auf UTF-8-Bytes, nicht auf JavaScript-
`string.length` beziehungsweise UTF-16-Codeunits:

- `MAX_RECONSTRUCTED_BYTES` ist ein Byte-Limit.
- `chunkSize` ist ein Byte-Limit.
- Der erste Implementierungsslice übernimmt als überprüfbare Defaults
  `DEFAULT_CHUNK_SIZE = 1024`, `MAX_CHUNK_COUNT = 256` und
  `MAX_RECONSTRUCTED_BYTES = 256 * 1024`; ein nativer Smoke-Test prüft, dass
  jeder einzelne SecureStore-Wert zusätzlich unter
  `STORE_ENTRY_MAX_BYTES` bleibt.
- Jeder einzelne Chunk, Header und Journalwert bleibt unter dem konservativ
  konfigurierten `STORE_ENTRY_MAX_BYTES` des Adapters. Die konkrete Konstante
  wird gegen Expo SDK 57 auf iOS und Android verifiziert; die Spezifikation
  behauptet keine native SecureStore-Grenze, die Expo nicht dokumentiert.
- `chunkSize <= STORE_ENTRY_MAX_BYTES` und die maximale Chunkzahl begrenzen die
  rekonstruierbare Nutzlast deterministisch auf höchstens 256 KiB.
- Chunk-Grenzen dürfen keine ungültigen UTF-8-Sequenzen erzeugen.
- Header-Längen und Validierung verwenden dieselbe Byte-Metrik.
- Bestehende Mehrbyte-Werte, insbesondere Emoji an der Chunk-Grenze, werden
  verlustfrei gelesen.
- Bei Überschreitung wird vor dem ersten neuen Chunk deterministisch abgelehnt.

Die konkrete Byte-Encoding-API muss im Implementierungsschritt gegen den
Expo-SDK-57-Runtime-Vertrag verifiziert werden. Eine Node-only API darf nicht
ohne diese Prüfung in den nativen Pfad gelangen. Ein Fehler bei der Byte-
Konvertierung oder bei der Grenzwertprüfung darf keinen ersten neuen Chunk
schreiben.

### 4. Session-Bootstrap und INITIAL_SESSION

Der Bootstrap besitzt eine monotone Transition-Generation und eine explizite
Ownership-Journalstruktur mit `candidateOwner`, `committedOwner`,
`pendingCleanupOwner` und Generation. Das Journal unterscheidet einen
vorbereiteten Kandidaten von einem vollständig aktivierten Besitzer. Ein
Kandidat darf daher nach einem Crash nicht als bereits berechtigt gelten.
Alle diese Felder liegen in einem einzigen versionierten Journal-Record; es
gibt keinen separaten `committedOwner`-Key, dessen Persistenz gegen die Phase
auslaufen könnte. Das Journal selbst wird über den v3-Storagevertrag
geschrieben.

Der Bootstrap hat folgende monotone Commit-Reihenfolge:

1. Supabase-Client, lokale Onboarding-Information und den Ownership-Journal-
   stand lesen.
2. Session-Snapshot und eingetroffene Auth-Events als versioniertes Envelope
   mit Eventtyp, Generation und Quelle erfassen.
3. Eine neue Generation reservieren und vor jedem destruktiven Schritt ein
   dauerhaftes Journal mit `previousCommittedOwner`, `candidateOwner` und
   `pendingCleanupOwner` schreiben. Das Auth-Event selbst ist keine
   Löschautorisierung.
4. Die bisherige Capability im Speicher invalidieren und Account-Gates
   schließen.
5. Den Journalzustand auf `cleaning_previous` setzen und den veralteten
   Besitzer aus dem lokalen Ownership-Snapshot idempotent bereinigen. Ein Crash
   oder Reject wird anhand desselben Journals fortgesetzt.
6. Nach erfolgreichem Cleanup `committedOwner = null` und die Phase
   `previous_cleaned` dauerhaft schreiben. Erst jetzt werden Legacy-Daten und
   der neue Kandidat behandelt.
7. `candidateOwner` mit Phase `preparing_candidate` setzen, Account-Storage
   und Query-Persistenz für dieselbe Generation erfolgreich öffnen und alle
   kritischen lokalen Ressourcen validieren.
8. Vor dem Commit prüfen, ob Generation und neuestes Event noch passen. Bei
   B -> C während A-Cleanup wird B nicht publiziert; B wird als Kandidat
   bereinigt und C erhält eine eigene Generation.
9. Das Ownership-Journal auf `ready_to_commit` setzen, danach
   `committedOwner` im selben Record dauerhaft schreiben und die Phase auf
   `committed` setzen.
10. In einer einzigen internen Transition `accountReady`, `setActiveUserId`,
   Sync-Freigabe und den sichtbaren erfolgreichen Session-Zustand publizieren.
11. Erst danach Kandidaten- und Cleanup-Marker entfernen. Bleibt der Marker
    wegen eines Rejects liegen, ist der Zustand idempotent wiederaufnehmbar und
    nicht erneut als parallele Transition zu starten.

`currentUserId` oder ein gleichwertiger aktivierter Account-Owner darf nicht vor
dem erfolgreichen lokalen Persistenz-Commit gesetzt werden. Ein Fehler in einem
Schritt vor `accountReady` muss:

- `accountReady = false` halten,
- Account-Sync und Account-Provider deaktiviert halten,
- den Fehler sichtbar an den Retry-Fallback geben,
- eine spätere `INITIAL_SESSION`- oder `TOKEN_REFRESHED`-Meldung nicht als
  impliziten Retry behandeln.

Ein automatischer `INITIAL_SESSION`-, `TOKEN_REFRESHED`- oder gleichwertiger
Event startet keinen impliziten Retry und darf einen Fehler nicht löschen. Ein
expliziter Nutzer-Login darf einen neuen Bootstrap starten, muss dafür aber
eine neue Transition-Generation beziehungsweise einen expliziten Retry-Intent
tragen. Alle asynchronen Schritte prüfen die Generation vor externen
Side-Effects; veraltete Transitionsschritte brechen ohne Aktivierung ab.

Der Supabase-Listener ist nur ein synchroner Ingress: Er erfasst Eventtyp,
Session-Snapshot, Quelle und eine strikt monotone `eventSeq` und reiht die
Arbeit außerhalb des Callbacks in genau eine serielle Reducer-Queue ein. Im
Auth-Callback selbst werden keine weiteren asynchronen Supabase-Aufrufe
ausgeführt; auch ein Queue-Reject wird synchron abgefangen und als Bootstrap-
Fehler gemeldet. `SIGNED_IN` wird nicht als neuer Account interpretiert,
solange sich die User-ID nicht geändert hat. `TOKEN_REFRESHED` vor
`INITIAL_SESSION` wird als gültiger früheres Envelope verarbeitet, nicht als
Beweis einer bestimmten Event-Reihenfolge.

Die Reducer-Regeln sind verbindlich: Events erhalten ihre `eventSeq` beim
Eingang; eine Transition erhält ihre `generation` erst beim Start; während
einer laufenden Transition werden spätere Envelopes gemerkt und vor der
Publikation geprüft; ein neuer User gewinnt nur nach idempotenter Bereinigung
des Kandidaten. Ein Transition-Worker fängt jeden Fehler ab, schließt die
Queue nicht dauerhaft und publiziert niemals einen veralteten Capability-
Token.

### 5. Account-Mismatch und Löschautorität

Ein Auth-Event mit Nutzer B ist keine Autorisierung, Nutzer B zu löschen. Der
zu löschende Nutzer wird aus der veralteten lokalen Ownership beziehungsweise
dem abgeschlossenen Snapshot abgeleitet. Der gemerkte Besitzer-Marker ist nur
eine Orphan-Hilfe, wenn kein autoritativer aktiver Event-Besitzer existiert.

| Snapshot | Auth-Event | gemerkter Marker | Erwartete Bereinigung | Darf aktiviert werden |
|---|---|---|---|---|
| A | `INITIAL_SESSION(B)` | B | A, falls A lokal vorbereitet oder aktiv war | B erst nach erfolgreichem Cleanup und Bootstrap |
| A | `SIGNED_IN(B)` | B | A, niemals B | B erst nach erfolgreichem Cleanup |
| A | `SIGNED_OUT(null)` | B | A; B nicht als aktiver Besitzer löschen | kein Account |
| null | `INITIAL_SESSION(null)` | B | B als Orphan | kein Account |
| A | kein neuer Event | A | kein Wechsel | A nach erfolgreichem Bootstrap |
| A | Event B, Cleanup A schlägt fehl | B | A bleibt geschützt und sichtbar als Fehler | kein B |

Die Bereinigung ist idempotent. Bei einem Wechsel wird der alte Account vor
dem neuen Account gesperrt, der Query-Cache geleert, der Sync gestoppt und der
lokale Speicher entfernt. Jeder Cleanup-Fehler verhindert die Aktivierung des
neuen Accounts. Globale lokale Ressourcen wie SQLite werden nur gelöscht,
wenn der Cleanup-Aufruf den erwarteten Ownership-Snapshot und die erwartete
Transition-Generation besitzt; ein späteres Event B darf nicht versehentlich
die globale Datenbank löschen, die noch A gehört.

Crash-/Restart-Matrix für die Ownership-Journalphasen:

Die Ownership-Phasen sind `prepared`, `cleaning_previous`,
`previous_cleaned`, `preparing_candidate`, `ready_to_commit` und `committed`.

| Crashpunkt | Persistenter Zustand | Restart-Aktion |
|---|---|---|
| vor `cleaning_previous` | `previous=A`, `candidate=B`, `pendingCleanup=A` | Gates geschlossen, A-Cleanup fortsetzen |
| während A-Cleanup | gleiche Phase, A ggf. teilweise bereinigt | A-Cleanup idempotent wiederholen; kein B aktivieren |
| nach A-Cleanup vor `committedOwner=null` | Phase `previous_cleaned` noch nicht sichtbar | A-Cleanup erneut validieren, dann `committedOwner=null` schreiben |
| während B-Kandidat | `committedOwner=null`, `candidate=B` | B-Kandidat verifizieren oder löschen; nie als aktiv lesen |
| nach `committedOwner=B` vor React-Publikation | Phase `committed`, B | B-Ressourcen prüfen, dann neuen Capability-Token ausstellen |
| B-Commit rejectet oder ist unklar | Journal `preparing_candidate`/`ready_to_commit` | B nicht aktivieren; Journal auswerten, bei Unklarheit fail-closed |

Ein `committedOwner` in einem Journal mit laufender Transition ist kein
Aktivierungssignal. Nur die Phase `committed` plus erfolgreiche
Ressourcenprüfung darf nach einem Restart wieder `accountReady` herstellen.
Wenn ein Journal-Write rejectet oder sein Ergebnis unklar ist, werden keine
weiteren destruktiven oder externen Schritte ausgeführt. Der Transition-Worker
meldet `OwnershipRecoveryError`, hält alle Gates geschlossen und lässt den
vorherigen Record zur erneuten Recovery stehen. Beim Neustart wird ausschließlich
die tatsächlich gelesene Phase fortgesetzt; ein fehlender oder widersprüchlicher
Record bleibt fail-closed.

### 6. Account-Provider-Gating

Die folgenden Operationen benötigen `accountReady`, nicht nur eine Session:

- `getDatabase()` und `initOffDump()` im Root-Navigator,
- Haushaltsqueries, Household-Bootstrap-Sync und aktive Haushaltsauswahl,
- RevenueCat-Login, Refresh, Attribute und Subscriber-Identity,
- PostHog-`identify` und userbezogene Flag-/Identity-Synchronisation,
- private Query-Persistenz und alle weiteren Account-gebundenen Sync-Einstiege.

Die Readiness-Grenze gilt nicht nur für React-Provider. Niedrige Einstiege wie
`getDatabase()`, verschlüsselte Account-Storage-Erzeugung, Query-Enablement und
Sync-Start müssen bei fehlendem oder veraltetem Ownership-Token ebenfalls
fail-closed abbrechen. Ein Provider-Gate allein reicht nicht, wenn ein Hook
oder eine Hilfsfunktion den gleichen Account-Side-Effect direkt auslöst.

Für diese Low-Level-Grenze reicht ein Boolean nicht. Der SessionProvider stellt
nach dem Commit einen nicht selbst konstruierbaren Capability-Token aus:

```ts
type AccountCapability = {
  readonly ownerId: string;
  readonly generation: number;
  readonly brand: unique symbol;
};
```

Die Runtime-Implementierung ergänzt die TypeScript-Marke durch ein privates
`Symbol`/`WeakSet`-Register in `account-capability.ts`; ein strukturell gleiches
Objekt aus einem Caller ist damit nicht gültig. Eine zentrale
Validierungsfunktion prüft Besitzer, Generation und den aktuell committeden
Readiness-Status. Beim Übergang aus `accountReady` wird der Token invalidiert.
Laufende Async-Operationen müssen vor jedem externen Side-Effect und vor jedem
Commit erneut validieren; ein Boolean oder eine Session allein genügt nicht.

Die vollständige Low-Level-Entry-Point-Liste ist Teil der Abnahme:

| Boundary | Owner/API, die den Capability-Token erzwingt |
|---|---|
| lokale DB und OFF | `src/lib/db/client.ts:getDatabase`, `src/lib/off-dump/off-dump.ts:initOffDump` |
| Query-Persistenz und Account-Storage | `startAccountQueryPersistence`, `getEncryptedAccountStorage` |
| Account-/Haushalts-Sync | `resumeAccountSync`, `triggerHouseholdsPull`, `useHouseholdsBootstrapSync`, `src/lib/sync/sync-runner.ts` |
| Haushalts-/private Query-Einstiege | `src/features/household/api.ts`, `src/features/meal-planner/use-meal-plans.ts`, `use-shopping-needs.ts`, `src/features/brochures/hooks/use-brochure-sync.ts`, `use-brochures.ts`, `src/features/product-search/sources/local-product-source.ts` und `off-dump-product-source.ts` |
| externe Identitäten | `PremiumProvider`/RevenueCat und `PostHogIdentitySync` inklusive Flag-Refresh |

Die Implementierung darf diese Liste nur erweitern. Eine statische Suche nach
`getDatabase(`, `triggerHouseholdsPull(`, `resumeAccountSync(`,
`getEncryptedAccountStorage(` und `session?.user.id` liefert vor dem
Checkpoint die geprüften Call-Sites; jeder neue Account-Side-Effect braucht
denselben Boundary-Owner.

Während `isLoading` oder bei `error` werden diese Provider nicht aktiviert oder
sofort neutralisiert. Ein Fehler-Fallback darf keine neue Account-Query und
keinen neuen Identity-Sync starten. Eine vorhandene Session darf für reine
Auth-/Retry-UI erhalten bleiben, aber nicht durch die Provider-Hierarchie
wandern.

Der Provider-Vertrag gilt auf iOS und Android identisch. Plattformdateien
dürfen die gleiche Readiness-Bedingung nicht unterschiedlich interpretieren.

### 7. Cleanup und Promise-Sicherheit

Jeder absichtlich gestartete Cleanup-Aufruf erhält einen expliziten
Rejection-Handler. Für den Orphan-Logout gilt:

- genau ein Logout-Versuch pro `orphanKey = markerOwner + detectedGeneration +
  cleanupOperation`,
- Fehler werden über einen kuratierten Fehlercode gemeldet,
- kein unhandled-rejection-Promise,
- der bestehende Hook darf bei weiteren Renders für denselben Key nicht erneut
  starten. Ein expliziter Retry oder eine neue erkannte Owner-Generation bildet
  einen neuen `orphanKey` und darf genau einen neuen Versuch auslösen.

Der Cleanup-Fehler darf nicht die eigentliche Account-ID, Session, Tokenwerte
oder rohe PostgREST-Nachrichten an Telemetrie weiterreichen.

### 8. Telemetrie und Datenschutz

Roh-User-IDs dürfen nicht in Telemetrie-Properties, Diagnose-Breadcrumbs,
Fehler-Properties oder Debug-Log-Payloads erscheinen. Für notwendige
Korrelation wird eine install-stabile, nicht reversible, dokumentierte
Pseudonym-Repräsentation verwendet: ein zufälliges Installations-Salt wird
verschlüsselt lokal gehalten und mit der User-ID gehasht. Ist das Salt nicht
verfügbar, wird kein User-Pseudonym gesendet. Cross-Device-Korrelation ist
bewusst kein Default und erfordert eine separate Produkt-/Datenschutzfreigabe.

RevenueCat- und PostHog-Identitäten sind unterschiedlich zu behandeln:

- RevenueCat erhält seine rohe kanonische App-User-ID erst nach `accountReady`,
  weil sie dort die fachliche Subscription-Identität und Cross-Device-
  Zuordnung trägt.
- PostHog erhält ausschließlich das install-stabile Telemetrie-Pseudonym und
  keine rohe User-ID, E-Mail oder `userId`-Property. Seine Offline-Queue macht
  eine nachträgliche Bereinigung durch `reset()` unmöglich; deshalb wird vor
  dem Versand zusätzlich eine Allowlist/Redaction-Hook verwendet, die alte
  Roh-ID-Events verwirft oder sicher pseudonymisiert.

Vor `accountReady` werden keine Identity-Calls ausgeführt; beim Verlassen von
`accountReady` wird die jeweilige Identität neutralisiert oder zurückgesetzt.
Eine spätere Änderung dieser Semantik braucht eine separate Produkt- und
Datenschutzfreigabe.

Telemetrie verwendet eine zentrale Allowlist für Properties. Caller dürfen kein
`user_id`-Feld einschleusen oder die Basiseigenschaften überschreiben. Exception-
Messages und externe Providerfehler werden vor dem Versand auf einen
kuratierten Fehlercode und eine sichere Kurzform reduziert.

Der Bootstrap verwendet eine feste Stage-Taxonomie, mindestens:

`client_initialize`, `session_restore`, `owner_read`, `stale_owner_cleanup`,
`legacy_migration`, `account_storage`, `query_persistence`, `owner_marker`,
`account_ready`, `auth_event_transition`, `provider_gate`, `cleanup`.

Jeder Fehler- und Erfolgsnachweis enthält die Stage, einen kuratierten
`error_code`, eine Korrelation und das Outcome. Es werden keine Tokeninhalte,
rohen SecureStore-Werte, vollständigen User-IDs oder unbereinigten
Provider-Fehlermeldungen aufgenommen. Die Stage-Taxonomie darf keine frei
formatierten User- oder Key-Namen enthalten.

### 9. Reverse and recovery states

Jede Aktivierung hat ein logisches Gegenstück:

- `accountReady = true` → deaktivieren und Cleanup vor Wechsel oder Logout,
- aktivierter Storage → löschen und bei Fehler wiederholbar sperren,
- gespeicherter lokaler Besitzer → nur bei passender Ownership vergessen,
- RevenueCat/PostHog-Identität → neutralisieren beziehungsweise resetten,
- gestartete Sync-/Persistenz-Handles → stoppen und erst nach erfolgreichem
  Bootstrap neu starten.

## Scope

### In scope

- `src/lib/storage/chunked-storage.ts` und fokussierte Tests.
- `src/lib/backend/supabase/client.ts`, soweit Adapter-Lifecycle oder
  Testbarkeit betroffen sind.
- `src/features/auth/session-provider.tsx` und Tests.
- `src/features/auth/account-capability.ts` und gezielte Token-/Generation-
  Tests als kleine Low-Level-Autorisierungsgrenze.
- `src/features/navigation/root-navigator.tsx` und Tests.
- `src/features/app-shell/app-providers.tsx` sowie `.android.tsx` und gezielte
  Provider-/Identity-Tests.
- `src/lib/storage/account-storage.ts`, `sign-out.ts` und Orphan-Logout-Hook
  samt Tests, wenn für den Vertrag erforderlich.
- `src/lib/telemetry/index.ts`, relevante Schema-/Debug-Log-Tests und die
  Bootstrap-Stage-Namen.
- Dokumentation dieser Recovery-Invarianten in diesem Spec.

### Out of scope

- Supabase-Schema, RLS, Migrationen oder `database.types.ts`.
- Wechsel des Auth-Anbieters oder der Session-Persistenzbibliothek.
- Einführung einer neuen Storage-, Telemetrie- oder State-Management-
  Dependency.
- Produktseitige Änderungen an Login, Onboarding oder Crash-Fallback-Copy.
- RevenueCat-Produkt-, Entitlement- oder Kauf-Flow-Änderungen.
- Eine allgemeine Neuschreibung aller Telemetrie-Events außerhalb des
  Auth-/Bootstrap- und Identitätscontracts.

## Tech Stack

- Expo SDK `~57.0.19`, React Native `0.86.3`, React `19.2.3`.
- `expo-secure-store ~57.0.3` als native Secret-Key-Value-API.
- `@supabase/supabase-js ^2.112.3` für Session und Auth-Events.
- `react-native-mmkv ^4.3.2` für verschlüsselten privaten Account-Speicher.
- RevenueCat `react-native-purchases ^10.7.1` und PostHog React Native
  `^4.63.5` für externe Identitätssynchronisation.
- TypeScript `~6.0.3`, Jest `~29.7.0`, `jest-expo`,
  `@testing-library/react-native ^14.0.1` und Bun `1.3.14`.

Es wird keine native oder JavaScript-Dependency hinzugefügt.

## Commands

Die Tests werden niemals mit `bun test` gestartet.

### Baseline und fokussierte Verifikation

```bash
bun run test --runInBand --no-watchman \
  src/lib/storage/chunked-storage.test.ts \
  src/lib/storage/account-storage.test.ts \
  src/features/auth/session-provider.test.tsx \
  src/features/navigation/root-navigator.test.tsx \
  src/features/household/active-household-provider.test.tsx \
  src/features/premium/premium-provider.test.tsx \
  src/features/app-shell/app-providers.test.tsx \
  src/features/app-shell/posthog-identity-sync.test.tsx \
  src/features/auth/sign-out.test.ts \
  src/features/profile/hooks/use-sign-out-on-orphaned-profile.test.ts \
  src/lib/telemetry/telemetry.test.ts
bun run check
bun run typecheck
```

### Erforderlicher Auth-Adapter-Integrationstest bei Lifecycle-Änderungen

```bash
bun run test:integration -- --runInBand --no-watchman \
  src/features/auth/auth.integration.test.ts
```

Wenn Session-/Adapter-Lifecycle geändert werden, benötigt dieser Test die
bereits konfigurierte lokale Testumgebung und ist verpflichtend. Die
Integrationstest-Konfiguration muss vor dem ersten Request fail-closed prüfen,
dass `EXPO_PUBLIC_SUPABASE_URL` auf `localhost`/`127.0.0.1` und den lokalen
Supabase-Port zeigt; Remote- oder linked-Projekte sind für diesen Test
unzulässig.

### Relevante Runtime-Gates nach Implementierung

```bash
bun run native:status
bun run native:dev -- --target ios-development-simulator
bun run native:dev -- --target android-development
```

Ein nativer Rebuild ist nur bei einem echten Fingerprint-Mismatch und mit der
im Projektvertrag vorgesehenen Freigabe zulässig. Für diese Spec-Phase wird
nicht gebaut.

Der native Smoke-Test persistiert auf iOS und Android eine synthetische v3-
Fixture, beendet den registrierten Dev-Artifact-Prozess, startet ihn neu und
prüft `recoverKey()`, Digest und inaktiven Slot. Zusätzlich werden der größte
unterstützte Einzelwert und ein deterministisch abgelehnter Oversize-Wert
geprüft. Partial Writes werden nicht als real nativ injizierbar behauptet; ihre
resolved/rejected/crash-Varianten bleiben Fault-Injection-Tests. Kann der
Smoke-Test die Restart- oder Queue-Redaction-Invariante nicht nachweisen, bleibt
der Checkpoint blockiert.

## Project Structure

```text
src/lib/storage/chunked-storage.ts                         SecureStore-Adapter
src/lib/storage/chunked-storage.test.ts                    Storage-Recovery-Vertrag
src/lib/storage/account-storage.ts                         privater Account-Key/MMKV
src/features/auth/account-capability.ts                    generationsgebundener Readiness-Token
src/features/auth/session-provider.tsx                     Session-/Bootstrap-Autorität
src/features/auth/session-provider.test.tsx                Auth-Event- und Fehlerfälle
src/features/navigation/root-navigator.tsx                 Root-Side-Effect-Gate
src/features/app-shell/app-providers.tsx                   Provider-Gate für iOS
src/features/app-shell/app-providers.android.tsx            Provider-Gate für Android
src/features/app-shell/app-providers.test.tsx               Plattformparität des Provider-Gates
src/features/app-shell/posthog-identity-sync.tsx            PostHog-Identity-Gate
src/features/premium/premium-provider.tsx                  RevenueCat-Identity-Gate
src/features/household/active-household-provider.tsx       Household-/Sync-Gate
src/features/auth/sign-out.ts                              Cleanup-Koordinator
src/features/profile/hooks/use-sign-out-on-orphaned-profile.ts Orphan-Logout
src/lib/telemetry/index.ts                                 pseudonyme Telemetrie
docs/specs/auth-bootstrap-recovery/SPEC.md                 dieser Vertrag
```

## Code Style and Ownership

Der SessionProvider besitzt den autoritativen Readiness-Zustand. Der
RootNavigator und die Account-Provider konsumieren ihn, aber sie rekonstruieren
keinen zweiten Bootstrap-Zustand. Der Chunk-Adapter besitzt die
Storage-Transaktion und keine Auth- oder UI-Entscheidungen.

Zielstil für Guarding, mit absichtlich generischen Namen:

```tsx
const { session, accountReady, capability, error } = useSession();
const canStartAccountRuntime =
  accountReady && capability !== null && session !== null && error === null;

useEffect(() => {
  if (!canStartAccountRuntime) return;
  void startAccountBoundRuntime(session.user.id, capability).catch((error) => {
    reportAccountRuntimeError(error);
  });
}, [canStartAccountRuntime, capability, session?.user.id]);
```

Verbindliche Regeln:

- Kein `any`, kein stilles `void` vor einem Promise mit möglicher Rejection.
- Readiness- und Ownership-Checks bleiben explizit und typisiert.
- Keine neue globale Auth-State-Maschine. Eine kleine, klar begrenzte
  process-weite Storage-Queue und ein Ownership-Journal sind zulässig, weil
  sie die nachgewiesenen Cross-Adapter- und Crash-Recovery-Grenzen tragen.
- Bestehende `setActiveUserId`, Sync-Gate-, Query-Persistenz- und Cleanup-APIs
  werden wiederverwendet oder mit einer begründeten kleinen Schnittstelle
  erweitert.
- Debug-/Telemetry-Properties enthalten nur kuratierte Werte.
- Die v1-Legacy-Kompatibilität bleibt bis zu einer separat freigegebenen
  Migration erhalten.

## Debugging and Reproduction Matrix

Jeder Bug muss vor einer Codeänderung mindestens als gezielter Testfall
reproduzierbar sein. Die folgende Matrix ist der minimale Nachweis:

| Fehler | Minimaler Repro | Root-Cause-Signal | Guard |
|---|---|---|---|
| Read/Write-Race | Store-Double pausiert Chunk-Cleanup, parallel `getItem()` | Read sieht Header ohne Chunks oder `null` | alle Operationen in derselben Queue |
| INITIAL_SESSION hebt Fehler auf | Query-Persistenz rejectet, danach `INITIAL_SESSION` mit derselben Session | `error` wird null oder Sync startet | kein impliziter Retry durch Auth-Event |
| Provider trotz Fallback | Bootstrap rejectet, Provider werden gerendert | DB/OFF, Household, RC oder PH werden aufgerufen | `accountReady`-Gate |
| Orphan-Fragmente | Fehler nach erstem neuen Chunk, neuer Adapter liest denselben Store | unreferenzierte Chunk-Keys bleiben | Pending-Journal plus begrenzte, referenzierte Recovery |
| falscher Account gelöscht | Snapshot A, Event B, gemerkter Marker B | Cleanup wird mit B aufgerufen | Snapshot-/Event-Ownership-Matrix |
| Orphan-Rejection | Orphan-Hook lässt Cleanup rejecten | unhandled rejection | expliziter Catch und Telemetrie |
| Roh-ID | User-ID in Telemetrie setzen | Telemetrie-/Logpayload enthält Originalwert | Allowlist, Pseudonym oder kein User-Feld und Negativassertion |
| falsches Größenlimit | Emoji/Mehrbyte-Text an Byte-Grenze | Store-Value überschreitet Byte-Limit oder wird beschädigt | UTF-8-Messung und Grenztests |

## Testing Strategy

### `secure-storage-transaction`

- Read während eines pausierten Writes bleibt bis zum Commit beim alten Wert.
- Read und Remove werden gegenüber laufenden Writes ebenfalls serialisiert.
- Zwei Adapterinstanzen über demselben `KeyValueStore` teilen die Queue; ein
  neuer Adapter nach einem simulierten Prozessneustart kann den persistenten
  Store anhand des Journals öffnen, den eindeutig gültigen Wert lesen und die
  begrenzten Pending-Fragmente bereinigen.
- Der Test simuliert zusätzlich einen scheinbar erfolgreichen Marker-Write,
  dessen Wert beim Prozessneustart fehlt; `recoverKey()` findet die Fragmente
  über den begrenzten Slot-Sweep und löscht nur den betroffenen Key.
- Fehler an jeder relevanten Write-Position werden injiziert: vor Pending,
  nach unbekanntem Pending-Commit, während Chunk-Schreiben, beim Header, beim
  Tombstone, beim alten Cleanup und beim Pending-Cleanup.
- Ein fehlgeschlagener Cleanup wird nicht verschluckt und ist beim nächsten
  Recovery-Lauf wiederholbar; ein nicht lesbares Journal führt zu einem
  fail-closed Read statt zu einem breiten Sweep.
- Physische Schlüssel verschiedener logischer Keys kollidieren nicht und eine
  Recovery löscht niemals Fragmente des Nachbarkeys.
- v1/v2 werden gelesen, v3 wird geschrieben, und kein gültiger Header verliert seine
  referenzierten Chunks.
- ASCII-, Umlaut-, Emoji- und Grenzwerte prüfen UTF-8-Bytes, nicht
  `string.length`.

### `session-bootstrap-authority`

- Realistisches `INITIAL_SESSION`-Event nach `getSession()` und nach einem
  abgelehnten Persistenzschritt.
- Fehler bleibt sichtbar; `accountReady`, `setActiveUserId`, Sync und Marker
  bleiben deaktiviert, bis `retry()` erfolgreich ist.
- Snapshot A/Event B/Marker B löscht A und aktiviert B erst danach.
- Globale Cleanup-Ressourcen prüfen Ownership-Snapshot und Generation, bevor
  sie SQLite, Query-Cache oder Sync-Zustand löschen.
- Cleanup-Fehler von A verhindern B.
- B -> C während A-Cleanup lässt weder B noch C vorzeitig aktiv werden und
  publiziert am Ende nur die letzte gültige Generation.
- Crash-/Reject-Simulationen decken Candidate-Journal, `committedOwner` und
  In-Memory-Publikation in jeder Reihenfolge ab.
- Orphan ohne Session wird nur für den gemerkten Besitzer bereinigt.
- Wiederholte, gleiche Auth-Events sind idempotent und starten keine zweite
  Migration oder zweite Query-Persistenz.
- Automatische Events ändern einen Fehlerzustand nicht; ein expliziter
  Login-/Retry-Intent startet eine neue Generation.

### `account-provider-gating`

- RootNavigator ruft `getDatabase()` und `initOffDump()` nur bei
  `accountReady` auf.
- ActiveHouseholdProvider startet keine Haushaltsquery oder Sync-Subscription
  im Fehler-Fallback.
- PremiumProvider ruft weder RevenueCat-Login noch Attribute/Refresh mit einer
  nicht bereiten Session auf.
- PostHog identifiziert im Fehler-Fallback keinen Nutzer, verwendet das
  install-stabile Pseudonym und resetet eine alte Identität beim Übergang zu
  keinem bereiten Account.
- iOS- und Android-Providerbäume haben denselben Guard-Vertrag.
- Direkte Low-Level-Einstiege bleiben auch ohne montierten Provider gesperrt.
- Readiness-Verlust während laufender DB-, Sync-, RevenueCat- und PostHog-
  Operationen verhindert deren abschließenden Commit oder Send.

### `cleanup-and-observability`

- Orphan-Logout-Rejection wird gefangen, gemeldet und erzeugt keinen globalen
  unhandled-rejection-Hinweis.
- Kein Rohwert der Test-User-ID erscheint in Telemetrie-Properties oder
  Debug-Log-Serialisierung; nur RevenueCat verwendet die kanonische App-User-
  ID nach erfolgreichem Readiness-Commit, PostHog erhält ausschließlich das
  install-stabile Pseudonym.
- Ein persistiertes PostHog-Offline-Event mit alter Roh-ID wird durch den
  Pre-Send-Allowlist-Hook verworfen oder nachweislich redigiert.
- Jede Bootstrap-Fehlerklasse enthält die erwartete Stage und den kuratierten
  Fehlercode.
- Telemetrie-Pseudonyme bleiben innerhalb einer Installation und über relevante
  Folgeevents stabil; Raw-ID-Negativtests decken Basiseigenschaften,
  Fehlerdetails und Breadcrumbs ab, während Provider-Tests den Zeitpunkt der
  Identity-Calls und das Reset-Verhalten prüfen.

### Testgrenzen

Die Unit-Tests bleiben fokussiert. Die vollständige Testsuite ist kein
automatisches Gate für jeden Zwischencommit, aber `bun run check` und
`bun run typecheck` müssen vor Abschluss grün sein. Ein nativer Smoke-Test auf
iOS und Android ist für SecureStore-Fehler und Provider-Gating vor dem Merge
erforderlich, weil native Promise-Rejections und tatsächliche Keychain-/Keystore-
Grenzen durch Jest nicht vollständig simuliert werden.

## Implementation Plan and Checkpoints

1. **Storage contract:** Queue, Pending-/Recovery-Protokoll und UTF-8-Byte-
   Messung mit Fault-Injection testen. Checkpoint: fokussierte Storage-Tests,
   Biome und Typecheck.
2. **Session authority:** `accountReady`, monotone Commit-Reihenfolge,
   INITIAL_SESSION- und Mismatch-Matrix umsetzen. Checkpoint: Session-Tests
   inklusive realistischem Event-Ordering.
3. **Provider gate:** Root- und App-Provider auf Readiness umstellen und
   Identitäts-Side-Effects testen. Checkpoint: RootNavigator-, Provider-,
   RevenueCat- und PostHog-Tests.
4. **Cleanup/telemetry:** Orphan-Rejection, pseudonyme ID und Stage-Taxonomie
   umsetzen. Checkpoint: Telemetrie-Negativtests und Cleanup-Tests.
5. **Runtime verification:** iOS-/Android-Dev-Build mit simulierten oder
   beobachteten SecureStore- und Bootstrap-Fehlern prüfen.

Jeder Schritt darf erst nach seinem Checkpoint erweitert werden. Die
Spezifikation wird aktualisiert, falls ein Checkpoint eine andere
Ownership-Grenze oder ein anderes Recovery-Protokoll erzwingt.

## Boundaries

### Always

- Diesen Spec und die aktuelle Session-/Storage-Ownership vor jeder
  Implementierungsänderung lesen.
- Fail-closed bei unvollständigem Cleanup oder unvollständiger Persistenz.
- Tests gegen echte neue Adapterinstanzen und Fehler-Injection ausführen.
- Roh-Token, Roh-User-IDs und unbereinigte externe Fehlermeldungen aus
  Logs/Telemetrie fernhalten.
- `bun run test`, `bun run check` und `bun run typecheck` gemäß Checkpoint nutzen.
- Keine Session allein als Account-Readiness interpretieren.

### Ask first

- Änderung an der fachlichen Semantik von `accountReady`, Retry oder
  Fehler-Fallback.
- Wechsel des Chunk-Headerformats ohne ausdrücklich dokumentierte
  Rückwärtskompatibilität.
- Neue native Dependencies, SecureStore-Optionen oder Config-Plugins.
- Änderung der Telemetrie-Aufbewahrung, Provider-Auswahl oder
  Pseudonymisierungssemantik.
- Änderungen an Datenbank, RLS, Sync-Verträgen oder produktseitigem Logout-
  Verhalten außerhalb dieses Specs.

### Never

- Keine manuellen Supabase-Migrationen oder Einweg-SQL-Befehle.
- Keine Roh-Access-/Refresh-Tokens oder vollständigen User-IDs in Testsnapshots,
  Logs oder Telemetrie.
- Keine stillen Promise-Rejections über `void`.
- Keine Aktivierung von Haushalts-, privaten Tracking-, RevenueCat- oder
  PostHog-Account-Ressourcen aus einem unbestätigten Session-Snapshot.
- Keine gelöschten Tests oder abgeschwächten Assertions, nur damit ein Gate
  grün wird.

## Success Criteria

- [ ] Jeder `getItem`-, `setItem`- und `removeItem`-Aufruf für einen Key ist
  linearisiert; der reproduzierte Read/Write-Race ist geschützt.
- [ ] Abgebrochene Writes hinterlassen nach erfolgreicher Recovery keine
  unreferenzierten SecureStore-Chunks.
- [ ] Ein neuer Adapter kann nach Prozessneustart Pending-Recovery sicher
  fortsetzen, ohne den gültigen Header zu löschen.
- [ ] Die Recovery-Präzedenz für fehlendes, ungültiges, verzögertes und nicht
  lesbares Journal ist durch einen typed `StorageRecoveryError` und eine
  begrenzte per-Key-Recovery eindeutig implementiert.
- [ ] Alle Größen- und Header-Limits sind UTF-8-byte-basiert und durch
  Mehrbyte-Grenztests abgesichert.
- [ ] `INITIAL_SESSION` oder `TOKEN_REFRESHED` kann einen Bootstrap-Fehler nicht
  löschen oder Sync wieder aktivieren.
- [ ] Snapshot A/Event B/Marker B löscht A, niemals B als Nebenwirkung des
  Mismatch-Resolutionspfads.
- [ ] Vor jeder destruktiven A-Bereinigung sind Owner, Generation und Phase
  dauerhaft im Ownership-Journal vermerkt; Kandidaten werden nie als aktiv
  gelesen.
- [ ] Jeder Account-bound Low-Level-Aufruf benötigt einen gültigen,
  generationsgebundenen Capability-Token; Session oder Boolean allein reicht
  nicht.
- [ ] Kein Account-Provider startet vor `accountReady`; der Fehler-Fallback
  bleibt frei von Account-Side-Effects.
- [ ] Orphan-Logout-Rejections werden behandelt und beobachtbar gemacht.
- [ ] Roh-User-IDs fehlen in Telemetrie-, Diagnose- und Debug-Payloads;
  RevenueCat-/PostHog-Identities werden ausschließlich nach `accountReady`
  synchronisiert; Bootstrap-Stages sind fein genug, um den fehlerhaften Schritt
  zu lokalisieren.
- [ ] PostHog erhält nur das Installations-Pseudonym und persistierte Legacy-
  Roh-ID-Events werden vor dem Versand verworfen oder sicher redigiert.
- [ ] Fokussierte Tests, `bun run check`, `bun run typecheck` und der notwendige
  native Smoke-Test sind grün.

## Source-Driven Notes

Die dokumentierten API-Fakten wurden gegen offizielle Quellen geprüft. Die
Fail-closed-, Journal- und Readiness-Regeln sind App-Policy und werden nicht
als native Garantie dieser Quellen ausgegeben:

- Expo SecureStore SDK 57: `getItemAsync` liefert `string | null` und kann bei
  Lesefehlern rejecten; `setItemAsync` und `deleteItemAsync` können ebenfalls
  rejecten. Große Payloads können vom nativen Unterbau abgelehnt werden, und
  SecureStore ist für kleine Werte wie Tokens und Schlüssel gedacht.
  Quelle: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
- Die SDK-57-Implementierung dokumentiert keinen Multi-Key-Commit. Die
  offizielle Expo-Quelle und der offizielle Expo-Issue-Tracker zeigen außerdem,
  dass native Persistenzantworten nicht als plattformübergreifende Crash-
  Durability-Garantie interpretiert werden dürfen. Das begründet Journal,
  Generations- und Integritätsprüfung, nicht eine stärkere SecureStore-
  Behauptung. Quellen:
  https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-secure-store/android/src/main/java/expo/modules/securestore/SecureStoreModule.kt
  und https://github.com/expo/expo/issues/48988
- Expo Authentication Guide: Native Auth-Ergebnisse können mit
  `expo-secure-store` rehydriert werden; der native Store ist nicht mit einem
  Web-Äquivalent gleichzusetzen.
  Quelle: https://docs.expo.dev/guides/authentication/
- Supabase `onAuthStateChange`: dokumentiert `INITIAL_SESSION`, `SIGNED_IN`,
  `SIGNED_OUT`, `TOKEN_REFRESHED` und die Subscription-Aufhebung. Daraus folgt
  als App-Policy, dass ein Event allein kein Nachweis für lokal erfolgreich
  committed Account-Persistenz ist.
  Quelle: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- Supabase warnt davor, im Auth-Callback selbst asynchrone Supabase-Aufrufe zu
  starten; außerdem kann `SIGNED_IN` eine Re-Establishment-Meldung sein und
  `TOKEN_REFRESHED` in realen Startup-Pfaden vor `INITIAL_SESSION` eintreffen.
  Quellen:
  https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0
  und https://github.com/supabase/supabase-js/issues/2126
- RevenueCat Identity: ein extern verwaltetes App User ID wird über die
  Identitäts-API gesetzt; beim Account-Wechsel ist ein direkter Wechsel der
  Identität möglich, während Logout eine anonyme Identität erzeugen kann. Die
  Spec bewahrt deshalb die rohe Produktidentität, gated sie aber lokal.
  Quelle: https://www.revenuecat.com/docs/customers/identifying-customers
- PostHog React Native: `identify` ordnet Events einer Identität zu; `reset`
  soll nach Logout die User- und Anonymous-ID zurücksetzen. Dass `identify`
  nicht vor lokaler Account-Readiness erfolgt, ist die App-Policy dieses
  Vertrags.
- PostHog kann Events offline persistent puffern; `reset()` ist daher kein
  nachträglicher Löschmechanismus für bereits gepufferte Roh-IDs. Das begründet
  das install-stabile Pseudonym und die Redaction vor `capture`, nicht erst beim
  Logout.
  Quelle: https://posthog.com/docs/libraries/react-native
- Apple Keychain Services und Android Keystore beschreiben sichere,
  plattformspezifische Speicherung beziehungsweise Schlüsselverwendung, aber
  keinen appweiten Multi-Key-Commit über Header, Chunks und Journal. Diese
  Transaktionssemantik bleibt deshalb vollständig App-Policy.
  Quellen: https://developer.apple.com/documentation/security/keychain-services
  und https://developer.android.com/privacy-and-security/keystore
- Android `SharedPreferences.Editor` dokumentiert nur die atomare Anwendung
  eines einzelnen Editors; Speicher-/Crash-Dauerhaftigkeit und mehrere
  Operationen sind davon nicht umfasst. Apple Keychain-Update/Delete liefern
  Status, aber keinen Multi-Key-Crashvertrag. Quellen:
  https://developer.android.com/reference/android/content/SharedPreferences.Editor
  und https://developer.apple.com/documentation/security/updating-and-deleting-keychain-items

Unverifiziert bis zur Implementierung bleiben die konkrete UTF-8-Encoding- und
Digest-API im Expo-57-Native-Runtime sowie die genaue Persistenzsemantik nach
einem nativen Reject oder einer scheinbar erfolgreichen Antwort. Diese Punkte
werden durch Fault-Injection, Manifest-Integritätsprüfungen und einen
iOS-/Android-Smoke-Test abgesichert.

## Binding Decisions and Remaining Questions

Die adversariale Review hat die sicherheitsrelevanten Entwurfsfragen
entschieden:

1. Das Telemetrie-Pseudonym ist install-stabil und nicht cross-device stabil.
   Es basiert auf einem zufälligen, lokal geschützten Salt; fehlt das Salt,
   wird kein User-Pseudonym versendet.
2. `accountReady` wird als explizites Feld im bestehenden `useSession()`-
   Vertrag eingeführt. `session` bleibt der Auth-Snapshot und wird nicht
   nachträglich als lokaler Berechtigungsnachweis umdefiniert.
3. Recovery verwendet den begrenzten Pending-/Ownership-Marker und, wenn der
   Marker fehlt, ausschließlich einen begrenzten Sweep über die zwei bekannten
   Slots des angeforderten Keys. Ein breiter Sweep über logische Keys ist nicht
   zulässig; bei nicht lesbarem Journal gilt der Schlüssel als gesperrt.
4. Automatische Auth-Events wiederholen keinen fehlgeschlagenen Bootstrap. Ein
   expliziter Login oder Retry trägt einen neuen Intent und eine neue
   Transition-Generation.
5. PostHog verwendet nur das install-stabile Pseudonym. Eine Pre-Send-
   Allowlist muss persistierte Legacy-Roh-ID-Events verwerfen oder redigieren;
   `reset()` allein genügt dafür nicht.

Vor der Implementierung braucht es nur noch die Maintainer-Freigabe für diese
Verträge. Falls die Produkt-/Datenschutzanforderung stattdessen eine
cross-device stabile Telemetrie-ID oder eine pseudonymisierte RevenueCat-App-
User-ID verlangt, wird dafür ein separater Spec-Änderungsentscheid benötigt;
das ist keine stille Implementierungsvariante.

## Review Status

- Spec-Driven Development: Draft mit Capability Map, Objective, Commands,
  Project Structure, Code Style, Testing Strategy, Boundaries und Success
  Criteria.
- Context Engineering: fokussierter Context Pack aus den betroffenen Quellen,
  Tests und vorhandenen Spec-Konventionen.
- Debugging and Error Recovery: Reproduce → Localize → Reduce → Root Cause →
  Guard ist als Debugging-Matrix und Checkpoint-Reihenfolge festgehalten.
- Source-Driven Development: offizielle Expo-, Supabase-, RevenueCat- und
  PostHog-Quellen sind verlinkt; nicht verifizierte Runtime-Annahmen sind
  ausdrücklich markiert.
- Doubt-Driven Development: Eine erste frische adversariale Review identifizierte
  20 konkrete Lücken zu Unknown-Commit-Zuständen, Journal-Recovery,
  Ownership-Autorität, Provider-Gates, Telemetrie und Testpräzision. Eine zweite
  Review verlangte zusätzlich präzise Journal-/Capability-/Queue-Verträge; eine
  abschließende Spot-Review fand keinen verbleibenden Blocker. Die bindenden
  Entscheidungen oben adressieren diese Punkte; Implementierung bleibt bis zur
  Maintainer-Freigabe gesperrt.
