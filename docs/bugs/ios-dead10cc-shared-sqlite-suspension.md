# iOS: `0xdead10cc` beim Suspendieren der geteilten SQLite-Datenbank

- Status: Offen, physische iPhone-Abnahme ausstehend
- Beads: `fam-t53z`
- Untersucht: 2026-11-13
- Quellstand der Untersuchung: Build 113 plus FEAT-001 bis FEAT-003 im Arbeitsstand
- Entscheidungsstatus: Variante A angenommen und im Quelltext umgesetzt; kein Produktions-Fixnachweis ohne neuen nativen Build

## Kurzfassung

TestFlight-Build 109 wurde nicht durch eine JavaScript-Exception, einen
Speicherfehler oder einen normalen nativen Absturz beendet. iOS beendete den
Prozess beim Suspendieren mit `RUNNINGBOARD 0xdead10cc`. Dieser Code bezeichnet
einen Prozess, der beim Suspendieren noch eine Datei- oder SQLite-Sperre hält.

Die App öffnet `fam-v2.db` im App-Group-Container
`group.com.goldjunge91.fam1`. Die Haupt-App und die Siri-Extension greifen
prozessübergreifend auf dieselbe SQLCipher-Datenbank zu. Der aktuelle
JavaScript-Lifecycle startet beim Wechsel zu `inactive` oder `background` nur
einen asynchronen Close. Dieser Close besitzt keine iOS-Ausführungszusicherung
und wartet zudem auf bereits reservierte Operationen. Dadurch kann iOS die App
suspendieren, während eine Schreibtransaktion noch offen ist.

Der genaue SQL-Aufruf ist im Crashreport nicht enthalten. Zwei Zustände müssen
zur Laufzeit unterschieden werden:

1. Die Datenbank läuft entgegen der Absicht im Journalmodus `DELETE`. Dann kann
   bereits eine Datenbanksperre beim Suspendieren zum Kill führen.
2. Die Datenbank läuft tatsächlich im Modus `WAL`. Dann blieb nach Apples
   dokumentiertem Modell eine Schreibtransaktion beim Suspendieren offen.

Der empfohlene erste Fix behält die gemeinsame WAL-Datenbank und den
Siri-Killed-State-Flow bei. Er ergänzt eine native iOS-Ausführungszusicherung
für alle schreibenden App-Group-Operationen, sperrt neue Foreground-Schreiber
vor der Suspension, trennt lange Arbeit von kurzen DB-Transaktionen und prüft
`WAL` auf beiden Prozessseiten. Eine private Hauptdatenbank mit separater,
verschlüsselter Siri-Inbox bleibt der Rückfallpfad, falls sich die gemeinsame
Datenbank trotz dieser Invarianten nicht zuverlässig betreiben lässt.

## Aktueller Implementierungsstand

Variante A bleibt verbindlich: Haupt-App und Siri verwenden weiterhin dieselbe
SQLCipher-/WAL-Datei. Der Rückfallpfad mit privater Hauptdatenbank und
verschlüsselter Siri-Inbox wurde nicht begonnen.

Im Arbeitsstand sind der iOS-only Expo-Lifecycle-Owner, die native AppDelegate-
Zulassung vor React Native AppState, die Writer-/Background-Token, die
lifecycle-aware SQLite-Öffnung, die kurzen App-Group-Leases sowie die
abort-aware OFF-/Sync-Phasen umgesetzt. Der native Admission-Race wird auf der
Main Queue vor `beginBackgroundTask` erneut geprüft. Nach Expiration wechselt der
Owner fail-closed nach `suspended`, bricht die abhängigen JS-Operationen ab und
hält die Assertion bis zum expliziten Rollback-/Ressourcen-Cleanup; erst danach
endet der Token idempotent. Bereits reservierte Lifecycle-Operationen dürfen
nach dem synchronen Close-Barrer kein neues Statement mehr starten. Der
systemgestartete BackgroundTask öffnet die Datenbank nur mit einem expliziten
Background-Kontext und beendet zuerst den Close und danach den Kontext. Die
Siri-Produktionsdateien bleiben unverändert; statische Verträge sichern ihren
synchronen WAL-, BEGIN-/COMMIT-oder-ROLLBACK- und Close-Pfad ohne
UIKit-Assertion.

Die grünen fokussierten Jest-, TypeScript-, Biome- und statischen Vertragsprüfungen
belegen keine UIApplication- oder RunningBoard-Suspension auf einem Gerät. Die
Review-Korrekturen halten native Token auch bei externer Abbruchmeldung bis zum
Rollback-/Detach-/Close-Cleanup, halten Account-Ownership während des
Background-Close, prüfen die Account-Generation in jedem Cutover-Dateischritt
und veröffentlichen den aktiven Household-Kontext über eine temporäre Datei und
same-container Move. OFF-Patch und Dump-Inspektion detachen über die bereits
gehaltene Writer-Scope statt nach der Lifecycle-Sperre einen neuen Foreground-
Writer anzufordern. Jeder native SQLite-Handle wird unmittelbar nach dem Öffnen
mit unveränderlicher Account-Ownership registriert. Diese Registrierung bleibt
bis zur erfolgreichen Veröffentlichung oder einem bestätigten Close bestehen.
Schlägt ein Close vor der Veröffentlichung fehl, bleibt der Handle für den
Lifecycle-Close sichtbar; der Background-Kontext kann dadurch nicht über ein
falsches `not-open` vorzeitig enden.

Ein neuer Dev-Client- oder TestFlight-Build ist für die native Schnittstelle
notwendig und wurde in dieser Sitzung nicht gestartet. `0xdead10cc` gilt daher
nicht als behoben.

## Gesicherter Crashbefund

### Angegebener Vorfall

| Feld | Wert |
| --- | --- |
| Analytics Point | `ePw7UaLvCDcAYbJhPasnk` |
| Incident | `F864D9AE-2F41-4CB9-86E4-345626B62445` |
| Version | `0.0.6 (109)` |
| Distribution | TestFlight |
| Gerät | `iPhone12,5` |
| Betriebssystem | iPhone OS 27.0.1 (`24A446`) |
| Start | 2026-11-07 21:48:19 +0100 |
| Terminierung | 2026-11-07 21:49:02 +0100 |
| Laufzeit | ungefähr 44 Sekunden |
| Exception | `EXC_CRASH (SIGKILL)` |
| Terminierungsgrund | `RUNNINGBOARD 0xdead10cc` |

### Nachfolgende Produktionsbelege

Der JavaScript-/WAL-Gegenmaßnahmenstand aus Build 112 enthielt `dbd9ecc0` und
beendete den Prozess nach ungefähr 99 Sekunden weiterhin mit
`RUNNINGBOARD 0xdead10cc`. Das widerlegt eine weitere JS-only-Close-Variante als
hinreichende Lösung.

Build 113 enthielt zusätzlich den separaten MMKV-Workaround `f2bd065c` sowie
die bis dahin vorhandenen WAL- und Sync-Gegenmaßnahmen. Der erhaltene Bericht

`/Users/marco/Library/Developer/Xcode/Products/com.goldjunge91.fam1/Crashes/Points/ePw7UaLvCDcAYbJhPasnk.xccrashpoint/Filters/Filter_ePw7UaLvCDcAYbJhPasnk-6803078545-com.goldjunge91.fam1-com.apple.platform.iphoneos-com.apple.platform.iphoneos-Any-Any/Logs/2026-11-13_20-36-47.9797_+0100-b8a269f07961af752ab5bcac3ea3b4a82e6a946f.crash`

belegt den erneuten Vorfall:

| Feld | Wert |
| --- | --- |
| Incident | `603E4000-61FB-4EA8-A0A2-BEDB5B9BA68C` |
| Version | `0.0.6 (113)` |
| Gerät / iOS | `iPhone12,5` / `iPhone OS 27.0.1 (24A446)` |
| Start | `2026-11-13 20:36:13.9323 +0100` |
| Terminierung | `2026-11-13 20:36:47.9797 +0100` |
| Laufzeit | ungefähr 34 Sekunden |
| Terminierungsgrund | `RUNNINGBOARD 0xdead10cc` |

Der Crashreport zeigt ausschließlich ruhende Threads und keinen identifizierbaren
MMKV-, SQLite- oder Writer-Ursprungsframe. Die Produktionsbelege verlangen
daher die native Admission-/Assertion-Grenze und nicht eine weitere
JavaScript-only Close-Änderung.

`~/Library/Developer/Xcode/Products/com.goldjunge91.fam1/Crashes/Points/`
`ePw7UaLvCDcAYbJhPasnk.xccrashpoint`.

Der Main Thread wartet im Crashreport regulär in `UIApplicationMain`. Das ist
bei einem systemseitigen Suspend-Kill kein Ursprungsframe. Die sichtbaren
Sentry-Threads überwachen den Prozess und belegen ebenfalls keine
Sentry-Ursache.

### Wiederholung

Im lokalen Xcode-Cache liegen zehn unterschiedliche Incident-IDs derselben
`0xdead10cc`-Gruppe. Die Zusammenfassung ist nach Incident-ID dedupliziert:

| Build | Vorfälle | Geräteklasse | iOS | Zeitraum |
| --- | ---: | --- | --- | --- |
| 82 | 5 | `iPhone12,5` | 27.0.1 | 2026-10-05 |
| 84 | 1 | `iPhone12,5` | 27.0.1 | 2026-10-05 |
| 100 | 2 | `iPhone14,8` | 27.0.1 | 2026-10-29 bis 2026-11-03 |
| 108 | 1 | `iPhone14,8` | 27.2 | 2026-11-07 |
| 109 | 1 | `iPhone12,5` | 27.0.1 | 2026-11-07 |

Die beiden jüngsten Vorfälle trafen innerhalb von zwölf Minuten zwei Builds,
zwei Geräteklassen und zwei iOS-Versionen. Der Fehler ist damit weder an Build
109 noch an ein einzelnes Gerät gebunden.

Die Meldung wird beim Entsperren sichtbar, der Kill geschieht aber beim
vorherigen Hintergrundübergang. Dieses zeitliche Verhalten passt zu
`0xdead10cc`.

## Technische Quellenlage

Apples [Technical Note TN2408](https://developer.apple.com/library/content/technotes/tn2408/_index.html)
unterscheidet für gemeinsam genutzte SQLite-Datenbanken zwei relevante Fälle:

- Im Journalmodus `DELETE` kann iOS den Prozess beim Suspendieren sofort
  beenden.
- Im Journalmodus `WAL` bleibt die gemeinsame Nutzung möglich. Ein Prozess darf
  beim Suspendieren jedoch keine Schreibtransaktion offen halten.
- Die Haupt-App soll für erforderliche Schreib- und Löschoperationen im
  gemeinsamen Container eine iOS-Background-Task-Assertion halten.
- App-Extensions können eine solche zusätzliche UIApplication-Assertion nicht
  selbst anfordern. Ihre Datei- und Datenbankarbeit muss innerhalb ihres vom
  System gewährten Ausführungsfensters vollständig enden.

SQLite dokumentiert für
[`PRAGMA journal_mode`](https://sqlite.org/pragma.html#pragma_journal_mode),
dass ein fehlgeschlagener Moduswechsel den bisherigen Modus als Ergebnis
zurückgibt. Ein ausgeführtes `PRAGMA journal_mode = WAL` beweist deshalb allein
nicht, dass die Datei anschließend wirklich im WAL-Modus läuft.

Die SQLite-Dokumentation zu
[Transaktionen](https://sqlite.org/lang_transaction.html) hält außerdem fest:

- `BEGIN IMMEDIATE` startet sofort eine Schreibtransaktion.
- Nach einem mit `SQLITE_BUSY` gescheiterten `COMMIT` bleibt die Transaktion
  aktiv und kann später erneut committed oder zurückgerollt werden.
- Es gibt pro WAL-Datei nur einen gleichzeitigen Writer.

Die [Expo-SQLite-Dokumentation für SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
belegt die verwendeten asynchronen Close- und Transaktions-APIs. Die im Projekt
installierte native Implementierung `expo-sqlite 57.0.3` führt `closeAsync()`
auf ihrer Modulwarteschlange aus und ruft danach natives `sqlite3_close` auf.
Ein gestartetes JavaScript-Promise gewährt der App aber keine zusätzliche
Ausführungszeit bis zur Suspension.

[`expo-background-task`](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/)
ist hierfür kein Ersatz. Das Paket plant verschiebbare Arbeit über
`BGTaskScheduler`; es hält eine bereits im Foreground gestartete
SQLite-Transaktion beim Sperren des Geräts nicht automatisch am Leben.

Ein lokales Expo-Modul kann laut
[Expo AppDelegate Subscribers](https://docs.expo.dev/modules/appdelegate-subscribers)
`applicationWillResignActive`, `applicationDidEnterBackground` und
`applicationDidBecomeActive` empfangen. Die installierte
`expo-modules-core 57.0.20`-Implementierung leitet diese Callbacks ebenfalls an
registrierte Subscriber weiter.

## Heutiger technischer Zustand

### Eine Datenbank in zwei Prozessen

`src/lib/db/local-client.ts` wählt auf iOS den App-Group-Pfad als primäres
Datenbankverzeichnis. `targets/siri/siri-shopping-list-database.swift` öffnet
dieselbe Datei `fam-v2.db` mit demselben SQLCipher-Schlüssel. Der
Convention-Test
`test/conventions/siri-main-app-intent-convention.test.ts` schreibt diese
Gleichheit ausdrücklich fest.

Diese Architektur ist beabsichtigt. Siri soll Artikel auch dann lokal samt
Outbox speichern, wenn die Haupt-App nicht läuft. Der frühere Siri-Bug
`fam-8zbm` und
`docs/architecture/2026-10-03-siri-killed-state-research.md` dokumentieren diese
Produktgrenze.

### WAL im Build-109-Ausgangsstand

Im untersuchten Ausgangsstand las `ensureWalJournalMode()` den Modus. War er nicht
`wal`, führte die Funktion `PRAGMA journal_mode = WAL` aus, las das Ergebnis
aber nicht erneut. Die Siri-Extension setzte `busy_timeout` und
`foreign_keys`, prüfte den Journalmodus aber ebenfalls nicht.

Der aktuelle Arbeitsstand liest und verifiziert `WAL` auf beiden Prozessseiten.
Ob der reale TestFlight-Prozess zur Laufzeit tatsächlich `WAL` verwendete, kann
der Build-113-Crashreport weiterhin nicht belegen.

### Transaktionen überleben mehrere JavaScript-Awaits

`src/lib/db/serialize.ts` implementiert exklusive Transaktionen manuell:

1. `BEGIN IMMEDIATE`
2. mehrere asynchrone Datenbankaufrufe aus TypeScript
3. `COMMIT` oder `ROLLBACK`

Zwischen diesen Aufrufen kehrt die Kontrolle jeweils in die
JavaScript-Laufzeit zurück. Eine Gerätesperre kann deshalb mitten in einer
bereits begonnenen Schreibtransaktion eintreten.

Im Build-109-Ausgangsstand wurde `execWithBusyRetry()` sowohl für
`BEGIN IMMEDIATE` als auch für `COMMIT` verwendet. Der aktuelle Arbeitsstand
retryt nur den Transaktionsstart, commit retryt nicht und rollt bei einem
Fehler fail-closed zurück. Ein Gerätesperrtest bleibt trotzdem erforderlich,
weil der Crashreport keinen konkreten Writer nennt.

### Der Close ist asynchron und wartet auf Arbeit

`src/lib/db/local-client.ts` registriert einen React-Native-`AppState`-Listener:

```text
inactive/background -> void closeDatabaseForLifecycle()
```

Der Aufruf besitzt folgende Grenzen:

- `void` wartet den Close nicht an einer iOS-Lifecycle-Grenze ab.
- Ein Promise verhindert die Suspension nicht.
- `closeForLifecycle()` reiht den nativen Close hinter bereits geplanten
  Statements ein.
- Aktive `withLifecycleOperationAsync()`-Vorgänge dürfen auch nach der
  Close-Anforderung weitere Statements einreihen.
- `getDatabase()` und `runWithCurrentDatabase()` können nach einem Close erneut
  öffnen, ohne den aktuellen AppState als Zulassungsbedingung zu prüfen.

Der aktuelle Mechanismus schützt mehrstufige Operationen vor einem Close in
ihrem Ablauf. Er garantiert aber nicht, dass vor der iOS-Suspension kein neuer
Writer mehr startet und kein bestehender Writer mehr aktiv ist.

### Lange OFF-Vorgänge teilen dieselbe Lifecycle-Reservierung

`src/lib/off-dump/off-dump.ts` hält eine Lifecycle-Reservierung über
mehrstufige Datei-, Netzwerk-, Attach-, Prüf- und Datenbankarbeit. Das bewahrt
die Connection vor einem Close zwischen zwei Schritten. Beim
Hintergrundübergang kann genau diese Eigenschaft jedoch dazu führen, dass der
Close auf unbestimmte Arbeit wartet oder ein späterer Schritt noch eine
Transaktion startet.

Die große Patch-Anwendung in `src/lib/off-dump/patch-applier.ts` verwendet eine
exklusive Transaktion. Sync-Pulls, Outbox-Schreibpfade, Realtime und mehrere
Feature-Repositories verwenden denselben zentralen Transaktionsmechanismus.
Der Crashreport benennt keinen dieser Pfade als einzelnen Verursacher.

### Weitere App-Group-Schreibvorgänge

Neben SQLite verändert die Haupt-App weitere Dateien im gemeinsamen Container:

- `src/features/household/active-household-store.ts` schreibt oder löscht
  `fam-siri-context-v1.json`.
- `src/lib/db/database-key-file-store.ts` verwaltet noch den einmaligen
  Schlüssel-Cleanup-Marker und alte Schlüsseldateien.
- Datenbank-Cutover und Löschung verändern DB-Dateien und Sidecars.
- Widgets und Watch-Snapshots verwenden ebenfalls App-Group-Speicher über ihre
  jeweiligen nativen APIs.

Die Untersuchung fand im produktiven Quellcode keinen Aufruf von
`UIApplication.beginBackgroundTask`. Diese Operationen besitzen daher heute
keine gemeinsame iOS-Ausführungszusicherung.

## Belegt und noch offen

### Belegt

- iOS beendet die App mit `RUNNINGBOARD 0xdead10cc` beim Suspendieren.
- Der Fehler tritt wiederholt über mehrere Builds, Geräte und iOS-Versionen auf.
- Haupt-App und Siri-Extension öffnen dieselbe App-Group-SQLite-Datei.
- Die Haupt-App führt Schreibtransaktionen mit `BEGIN IMMEDIATE` aus.
- Der Hintergrund-Close ist asynchron und besitzt keine
  UIApplication-Background-Task-Assertion.
- Der Close wartet auf reservierte Arbeit, die nach der Close-Anforderung noch
  Statements starten darf.
- Der tatsächlich aktive Journalmodus wird nicht auf beiden Prozessseiten
  verifiziert.

### Nicht aus dem Crashreport beweisbar

- Welcher Dateipfad beim konkreten Incident gesperrt war.
- Welcher SQL-Befehl oder Feature-Flow die Sperre hielt.
- Ob Build 109 zur Laufzeit `WAL` oder `DELETE` verwendete.
- Ob ein `COMMIT`-Retry, eine normale Schreibtransaktion, ein Startup-Cutover,
  eine OFF-Operation oder ein anderer App-Group-Schreibvorgang aktiv war.
- Welcher Git-Commit exakt in Build 109 enthalten war. Der Crashreport enthält
  keinen Quellstandbezeichner.

Diese Unsicherheiten ändern nicht die erforderliche Invariante: Vor einer
Suspension darf kein ungeschützter Writer im App-Group-Container aktiv bleiben.

## Zielinvarianten für die Behebung

1. Die Haupt-App und die Siri-Extension verwenden `fam-v2.db` nur, wenn der
   ausgelesene Journalmodus exakt `wal` ist.
2. Jede schreibende oder löschende Haupt-App-Operation im App-Group-Container
   hält vor ihrem ersten Dateizugriff eine gültige, benannte
   UIApplication-Background-Task-Assertion.
3. Eine DB-Schreibzusicherung beginnt vor `BEGIN IMMEDIATE` und endet erst nach
   erfolgreichem `COMMIT` oder abgeschlossenem `ROLLBACK`.
4. `applicationWillResignActive` sperrt neue Foreground-Schreiber nativ, bevor
   ein asynchrones React-Native-Ereignis verarbeitet werden muss.
5. Nach Eintritt in den Hintergrund öffnet die normale Foreground-Laufzeit die
   Datenbank nicht erneut. Nur ein ausdrücklich markierter, vom System
   gestarteter Background-Task darf Datenbankarbeit beginnen.
6. Ein Ablaufdatum der Ausführungszusicherung startet keinen weiteren
   Commit-Retry. Der Pfad bricht ab, rollt zurück und gibt die Sperre frei.
7. Netzwerk-Downloads und andere unbeschränkt lange Arbeit laufen nie innerhalb
   einer offenen SQLite-Schreibtransaktion oder einer Ausführungszusicherung,
   die auf ihren Abschluss warten muss.
8. Die Siri-Extension hält ihre synchrone DB-Arbeit kurz, prüft WAL, rollt bei
   jedem Fehler zurück und schließt alle Statements sowie die Connection vor
   dem Ende von `perform()`.
9. Diagnostik enthält Operationsart, Dauer, AppState, Journalmodus und
   Assertion-Zustand, aber weder SQLCipher-Schlüssel noch SQL-Parameter,
   Artikelnamen oder Haushaltsdaten.

## Empfohlener Fixpfad

Der folgende Pfad ist eine Empfehlung, keine bereits akzeptierte
Architekturentscheidung.

### Schritt 1: iOS-Ausführungszusicherung als lokalen nativen Owner ergänzen

Ein kleines iOS-only Expo-Modul unter beispielsweise
`modules/fam-shared-store-lifecycle/` besitzt ausschließlich die
App-Group-Ausführungsgrenze:

- eine synchrone Funktion zum Start einer benannten
  `UIApplication.beginBackgroundTask(withName:expirationHandler:)`-Assertion;
- eine idempotente Funktion zum Beenden des zurückgegebenen Tokens;
- native Zustände für `active`, `resigning`, `background` und `expired`;
- einen `ExpoAppDelegateSubscriber`, der mindestens
  `applicationWillResignActive`, `applicationDidEnterBackground` und
  `applicationDidBecomeActive` empfängt;
- eine Expiration-Meldung an den TypeScript-Owner;
- Refcount oder einzelne Tokens, sodass jede gestartete Assertion auf jedem
  Erfolgs- und Fehlerpfad genau einmal endet.

Der sicherheitsrelevante Zulassungszustand bleibt nativ. Ein verspätetes
JavaScript-Event darf nicht ermöglichen, dass nach `willResignActive` noch ein
neuer Foreground-Writer startet.

Die Assertion ist notwendig, aber allein noch keine vollständige
Freigabegarantie. Das neue Modul besitzt den nativen Expo-SQLite-Handle nicht
und kann deshalb in seinem Expiration-Handler nicht automatisch selbst einen
Rollback erzwingen. Vor der Freigabe von Pfad A muss belegt werden, dass jede
Transaktion zeitlich begrenzt ist und der Expo-SQLite-Owner auf Expiration noch
zuverlässig rollbacken und schließen kann. Gelingt dieser Nachweis nicht, muss
entweder der native SQLite-Owner selbst die Expiration behandeln oder der
private Datenbankpfad mit separater Siri-Inbox gewählt werden. Eine bloße
Expiration-Meldung an JavaScript reicht als Sicherheitsbeleg nicht aus.

Diese Ergänzung verwendet das vorhandene Expo-Modules-System und benötigt
keine neue Drittanbieterabhängigkeit. Sie verändert nativen Code und erfordert
anschließend einen neu gebauten Development Client beziehungsweise
TestFlight-Build. Ein Build gehört nicht in die Dokumentationsphase und wird
nur nach ausdrücklicher Freigabe gestartet.

### Schritt 2: Schreibzusicherungen am zentralen DB-Port durchsetzen

`src/lib/db/serialize.ts` erhält die Ausführungszusicherung als kleine
Abhängigkeit statt einen direkten UIKit-Import. Dadurch bleiben Node-Tests und
Android unabhängig.

Für exklusive Transaktionen gilt genau diese Reihenfolge:

1. native Schreibzusicherung erfolgreich erwerben;
2. `BEGIN IMMEDIATE` ausführen;
3. Transaktionsfunktion ausführen;
4. `COMMIT` ausführen;
5. bei jedem Fehler `ROLLBACK` versuchen;
6. erst danach die native Zusicherung in `finally` beenden.

`BEGIN`- und `COMMIT`-Retry werden getrennt. Ein fehlgeschlagenes `BEGIN` darf
kurz erneut versucht werden, solange noch keine eigene Transaktion besteht.
Ein fehlgeschlagenes `COMMIT` darf nur erneut versucht werden, solange die
native Zusicherung gültig ist. Bei Expiration oder fehlender Zulassung folgt
sofort der Rollback-Pfad statt eines Timer-Wartens mit offenem Write-Lock.

Nichttransaktionale mutierende `runAsync()`- und `execAsync()`-Aufrufe brauchen
dieselbe Zusicherung. Reads über `getFirstAsync()`, `getAllAsync()` und sauber
finalisierte Raw-Statements benötigen keine Writer-Zusicherung, solange WAL
belegt ist.

### Schritt 3: WAL beidseitig fail-closed prüfen

`src/lib/db/local-client.ts` darf nicht nur das Setzen anstoßen. Der Rückgabewert
von `PRAGMA journal_mode = WAL` oder eine anschließende Abfrage muss exakt
`wal` liefern. Andernfalls bleibt die Datenbank für normale Nutzung gesperrt,
der Fehler wird ohne sensible Daten gemeldet und es startet keine Migration
oder Schreibtransaktion.

`targets/siri/siri-shopping-list-database.swift` prüft den Journalmodus direkt
nach Key-Verifikation. Die Extension darf eine nicht als WAL erkannte Datei
nicht lesen oder beschreiben und verweist den Nutzer auf einen App-Start zur
Reparatur. Der Main-App-Owner bleibt für den Moduswechsel zuständig.

Die Diagnose zeichnet den beobachteten Modus einmal pro Connection auf. Damit
lässt sich nach einem Gerätezyklus eindeutig zwischen dem DELETE- und dem
WAL-Fall unterscheiden.

### Schritt 4: Lifecycle als Zulassungszustand statt als spätes Close modellieren

`src/lib/db/local-client.ts` erhält einen expliziten Ausführungszustand:

- `active`: normale Reads und Writes erlaubt;
- `draining`: keine neue Foreground-Arbeit, laufende Writer enden unter ihrer
  nativen Zusicherung;
- `background-task`: nur innerhalb eines ausdrücklich geöffneten
  systemgestarteten Task-Kontexts;
- `suspended`: kein Öffnen und kein Statement.

Der vorhandene AppState-Close kann eine idle Connection weiterhin aufräumen,
ist aber nicht mehr die Schutzgrenze. `getDatabase()` und
`runWithCurrentDatabase()` dürfen nach einem Background-Close erst bei
`active` erneut öffnen. Der heutige automatische Retry nach einem Close darf
im Hintergrund keine neue Connection erzeugen.

`withLifecycleOperationAsync()` darf nach `draining` keine neue Transaktion
mehr beginnen. Mehrstufige Vorgänge erhalten ein Abbruchsignal und müssen an
einer sicheren Grenze pausieren oder beim nächsten Foreground neu starten.
Eine bereits offene kurze Transaktion darf unter ihrer Assertion abschließen;
unbeschränkt lange Folgeschritte dürfen das Schließen nicht blockieren.

### Schritt 5: OFF- und Sync-Arbeit in suspendierbare Phasen trennen

Für den OpenFoodFacts-Pfad gilt:

- Download, Prüfsummenberechnung und Vorbereitung ohne offene
  Hauptdatenbank-Schreibtransaktion;
- vor Attach, Metadatenänderung oder Patch-Commit den Lifecycle erneut prüfen;
- den eigentlichen DB-Commit kurz und unter Writer-Assertion halten;
- bei `draining` den vorbereiteten Zustand sichern und den Commit auf den
  nächsten zulässigen Lauf verschieben;
- keine Connection-Reservierung über einen Netzaufruf halten, wenn sie einen
  Background-Close verhindert oder später noch einen Writer starten darf.

Foreground-Sync folgt demselben Muster: Netzwerk außerhalb der Transaktion,
kurze lokale Seitencommits unter Writer-Assertion, keine neue Seite nach
`willResignActive`.

Der über `expo-background-task` gestartete Sync bekommt einen ausdrücklich
markierten `background-task`-Kontext. Sein
`BackgroundTask.addExpirationListener()` löst ein Abbruchsignal aus. Nach der
Expiration beginnt keine neue Seite und keine neue Transaktion; `finally`
schließt nur noch bereits freigegebene Ressourcen.

### Schritt 6: Andere App-Group-Dateiänderungen absichern

`active-household-store.ts`, `database-key-file-store.ts`, Datenbank-Cutover und
Löschpfade verwenden denselben nativen Activity-Owner für Schreib-, Move- und
Delete-Operationen. Kleine JSON-Dateien werden über eine temporäre Datei und
einen atomaren Replace veröffentlicht, nicht durch sichtbares Truncate plus
Write.

Widget- und Watch-Snapshot-Pfade werden inventarisiert. Wenn deren Frameworks
die Ausführungsgrenze selbst besitzen, wird das anhand der nativen
Implementierung dokumentiert. Andernfalls werden auch diese Aufrufe in die
gemeinsame Grenze aufgenommen.

### Schritt 7: Siri-Extension begrenzen und belegen

Die Siri-Extension kann nach TN2408 keine zusätzliche UIApplication-Assertion
anfordern. Ihr vorhandener synchroner Pfad bleibt deshalb bewusst klein:

- App-Group- und Keychain-Kontext lesen;
- Journalmodus prüfen;
- `BEGIN IMMEDIATE`;
- Liste validieren und Artikel samt Outbox/History schreiben;
- committen oder zurückrollen;
- Statements und Connection schließen;
- erst danach aus `perform()` zurückkehren.

Netzwerkzugriffe, App-Start und lange Warteschleifen bleiben aus der Extension
heraus. `busy_timeout` darf nicht zu einem unkontrollierten Warten bis zum Ende
des Extension-Fensters führen. Bei belegter Konkurrenz soll Siri verständlich
fehlschlagen, statt einen langen Lock-Zyklus zu starten.

### Schritt 8: Diagnostik mit dem Fix ausliefern

Es ist kein eigener Diagnose-Build nötig. Der Fix-Build zeichnet ohne sensible
Daten auf:

- Connection-ID und Journalmodus;
- Transaktionsart und zufällige lokale Diagnose-ID;
- Zeitpunkte für Assertion, `BEGIN`, `COMMIT`, `ROLLBACK`, Close und Expiration;
- AppState und systemgestarteten Background-Task-Kontext;
- Dauer und Ergebniscode.

Ein noch gesetzter Transaktionsmarker beim nächsten Start wird als mögliche
unterbrochene DB-Operation gemeldet. Der heutige Sessionmarker stuft einen in
`background` beendeten Prozess allgemein als Hintergrundterminierung ein und
reicht allein nicht zur Unterscheidung dieses Fehlers.

## Prüf- und Freigabeplan für die physische Abnahme

### Fokussierte automatische Prüfungen

- `src/lib/db/serialize.test.ts`
  - Assertion umfasst `BEGIN` bis `COMMIT` oder `ROLLBACK`.
  - Kein Commit-Retry nach Expiration.
  - Neue Writer werden in `draining` abgelehnt.
- `src/lib/db/local-client.test.ts`
  - WAL wird nach dem Setzen erneut belegt.
  - Nicht-WAL schlägt vor Migrationen und Writes fehl.
  - Kein Reopen während `draining` oder `suspended`.
  - Expliziter Background-Task-Kontext bleibt nutzbar.
  - Verschlüsselte, Klartext- und Cutover-Handles bleiben bei einem
    fehlgeschlagenen Close unter ihrer ursprünglichen Account-Ownership sichtbar.
  - Ein Close nach abgelaufener Cutover-Öffnung meldet nicht fälschlich `not-open`.
- `src/lib/off-dump/off-dump.test.ts`
  - Backgrounding zwischen Download und Commit startet keinen Writer.
  - Ein vorbereiteter Vorgang kann beim nächsten Foreground fortgesetzt werden.
- `src/lib/sync/remote-background-sync.test.ts`
  - Expiration bricht vor der nächsten DB-Seite ab und schließt den Kontext.
- Tests für `active-household-store.ts` und `database-key-file-store.ts`
  - Assertion-Ende in Erfolgs- und Fehlerpfaden.
  - atomare Veröffentlichung und wiederholbarer Cleanup.
- Swift-Tests für das lokale Expo-Modul
  - Token-Lebenszyklus, doppelte Ends, Expiration und AppDelegate-Zustände.
- Siri-Swift-Tests
  - WAL-Prüfung, Busy-Fehler, Rollback und Connection-Close.

Es werden nur die betroffenen Testdateien mit `bun run test <datei>` ausgeführt.
`bun test` und die vollständige Testsuite bleiben ausgeschlossen.

### Geräteprüfung

Ein echter iOS-Build ist erforderlich, weil JavaScript-Tests weder
UIApplication-Assertions noch RunningBoard-Suspension belegen. Die aktuellen
fokussierten Prüfungen sind nur Source-/Port-Verträge. Sie sind grün, schließen
aber einen neuen nativen Build und die physische Abnahme nicht ein.

Gezielte Fälle:

1. App öffnen, idle sperren und wieder entsperren.
2. Eine normale lokale Einkaufslistenmutation starten und unmittelbar sperren.
3. Einen Sync-Seitencommit während des Sperrens erzwingen.
4. Einen OFF-Patch vorbereiten, zwischen Vorbereitung und Commit sperren und
   nach Foreground fortsetzen.
5. App während Datenbanköffnung beziehungsweise Migration sperren.
6. Siri bei vollständig beendeter Haupt-App schreiben lassen und danach die
   Outbox-Synchronisierung prüfen.
7. Einen systemgestarteten Background-Sync auslösen und dessen Expiration-Pfad
   prüfen.

Der Test muss in den Geräte- und RunningBoard-Logs zeigen:

- `journal_mode=wal` in Haupt-App und Siri-Extension;
- kein Writer beginnt nach `willResignActive`, außer im ausdrücklich markierten
  Background-Task-Kontext;
- jede gestartete Assertion endet;
- bei Expiration endet oder rollt die Transaktion zurück, bevor die Assertion
  endet;
- kein `RUNNINGBOARD 0xdead10cc`;
- keine verlorene oder doppelte Outbox-Mutation.

Ein Build, eine Installation oder ein Gerätetest benötigt Marcos ausdrückliche
Freigabe. Laufende Builds bleiben unangetastet.

### Release-Beobachtung

Nach dem gezielten Gerätetest wird der korrigierte TestFlight-Build gegenüber
dem Analytics Point `ePw7UaLvCDcAYbJhPasnk` beobachtet. Der Befund gilt erst als
behoben, wenn der erzwungene Sperrtest grün ist und der freigegebene Build keine
neuen Incidents dieser Gruppe erzeugt. Ein leerer kurzer Beobachtungszeitraum
ersetzt den erzwungenen Test nicht.

## Bewertete Alternativen

### Nur `closeAsync()` durch `closeSync()` ersetzen

Nicht empfohlen. Ein synchroner Close auf dem JavaScript-Thread ist noch keine
Zulassungssperre vor `willResignActive`. Er kann mit bereits laufenden
asynchronen Statements kollidieren, den UI-Thread blockieren und löst weder
neue Background-Writer noch lange Lifecycle-Reservierungen.

### Nur früher auf React-Native-`AppState` reagieren

Nicht ausreichend. Der native Lifecycle entscheidet über die Suspension. Ein
JavaScript-Callback besitzt keine zusätzliche Ausführungszeit und kann bereits
zu spät eintreffen.

### `busy_timeout` erhöhen oder mehr Retries hinzufügen

Abgelehnt. Nach einem fehlgeschlagenen `COMMIT` kann die Transaktion offen
bleiben. Mehr Warten vergrößert dann genau das Suspend-Fenster, das den Crash
auslöst.

### `expo-background-task` als Schutz verwenden

Abgelehnt. Das Paket plant verschiebbare, systemgestartete Arbeit. Es ersetzt
keine UIKit-Assertion für eine bereits laufende Foreground-Dateioperation.

### Siri deaktivieren oder den Killed-State-Flow entfernen

Nicht empfohlen. Das würde den bestätigten Produktvertrag aus `fam-8zbm`
zurücknehmen, obwohl Apple eine geteilte WAL-Datenbank grundsätzlich
unterstützt.

### Hauptdatenbank privatisieren und Siri entkoppeln

Technisch am stärksten isoliert, aber deutlich größer. Dieser Weg wird zum
Rückfallpfad, wenn eine der folgenden Bedingungen eintritt:

- WAL kann unter SQLCipher auf dem Gerät nicht zuverlässig belegt werden.
- Die native Expiration kann eine Expo-SQLite-Transaktion nicht rechtzeitig
  freigeben.
- Der erzwungene Sperrtest erzeugt trotz Writer-Assertions erneut
  `0xdead10cc`.
- App und Extension benötigen langfristig unabhängigere Schema- oder
  Releasezyklen.

Dann gilt:

1. Die Hauptdatenbank liegt wieder im privaten Expo-SQLite-Verzeichnis.
2. Siri liest einen versionierten, verschlüsselten Store-Snapshot aus der App
   Group und schreibt idempotente Befehle in eine getrennte, verschlüsselte
   Inbox.
3. Die Haupt-App importiert Inbox-Befehle über den normalen
   Einkaufslisten-/Outbox-Pfad und quittiert sie erst nach lokalem Commit.
4. Jeder Befehl besitzt eine stabile ID, damit ein Crash während des Imports
   keine doppelten Artikel erzeugt.
5. Der Umzug der bestehenden Datenbank verwendet
   [`SQLite.backupDatabaseAsync`](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#sqlitebackupdatabaseasyncoptions)
   beziehungsweise die SQLite
   [Online Backup API](https://sqlite.org/backup.html). Die App kopiert nicht
   eigenständig eine möglicherweise aktive Kombination aus `.db`, `-wal` und
   `-shm`.
6. Ein zweiphasiger Rollout stellt zuerst die neue Extension-Inbox bereit und
   migriert erst danach die nicht mehr von Siri geöffnete alte Hauptdatenbank.
7. Quelldateien bleiben bis nach Integritäts-, Eigentümer- und
   Outbox-Paritätsprüfung erhalten.

Dieser Rückfallpfad benötigt eine eigene, von Marco akzeptierte ADR, weil er
Datenbesitz, Siri-Sichtbarkeit, Migration und Offline-Semantik verändert.

## Umgesetzte Quellen und bewusste Grenzen

Der Arbeitsstand enthält die FEAT-001/002-Integration und die FEAT-003-Änderungen
für native Lifecycle-Zulassung, SQLite-Writer, App-Group-Dateien, OFF, Sync und
den systemgestarteten BackgroundTask. Die generierten `ios/`- und `android/`
Ausgaben wurden nicht geändert.

Die WidgetKit-Timeline-Übergabe, WatchConnectivity-IPC und der extension-eigene
Watch-Speicher bleiben außerhalb des Haupt-App-Writer-Owners. Die Begründung und
der statische Ownership-Vertrag stehen in
`test/conventions/app-group-writer-ownership.test.ts`. Siri bleibt ein eigener
synchroner Prozess ohne `UIApplication`-Assertion.

## Architekturentscheidung und Freigabegrenze

Variante A ist angenommen und umgesetzt: Die gemeinsame SQLCipher-/WAL-Datei
und der bestehende Siri-Killed-State-Flow bleiben erhalten. Variante B mit
privater Hauptdatenbank und verschlüsselter Siri-Inbox ist ausschließlich der
dokumentierte Rückfallpfad und nicht Teil dieser Änderung.

Ein neuer Dev-Client- oder TestFlight-Build ist zwingend erforderlich, weil das
lokale iOS-Expo-Modul erst durch den nativen Build in die App gelangt. Bis dahin
bleibt der Beads-Bug `fam-t53z` offen. Die physische iPhone-Abnahme darf erst
nach den erzwungenen Sperr-, Expiration-, Accountwechsel-, Cutover-, Siri- und
Outbox-Szenarien als abgeschlossen gelten.

## Quellen

### Primärquellen

- Apple, [Technical Note TN2408: Accessing Shared Data from an App Extension and its Containing App](https://developer.apple.com/library/content/technotes/tn2408/_index.html)
- Apple Developer Forums, [`0xdead10cc` und zusätzliche Hintergrundzeit](https://developer.apple.com/forums/thread/126438)
- Expo SDK 57, [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- Expo SDK 57, [BackgroundTask](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/)
- Expo, [iOS AppDelegate subscribers](https://docs.expo.dev/modules/appdelegate-subscribers)
- SQLite, [`PRAGMA journal_mode`](https://sqlite.org/pragma.html#pragma_journal_mode)
- SQLite, [Transactions](https://sqlite.org/lang_transaction.html)
- SQLite, [Write-Ahead Logging](https://sqlite.org/wal.html)
- SQLite, [Online Backup API](https://sqlite.org/backup.html)

### Projektquellen

- `src/lib/db/local-client.ts`
- `src/lib/db/serialize.ts`
- `src/lib/off-dump/off-dump.ts`
- `src/lib/off-dump/patch-applier.ts`
- `src/lib/sync/remote-background-sync.ts`
- `targets/siri/siri-shopping-list-database.swift`
- `targets/siri/siri-shopping-list-database-writer.swift`
- `docs/architecture/2026-10-03-siri-killed-state-research.md`
- `tasks/siri/plan.md`
- Beads `fam-8zbm` und `fam-t53z`

Externe Quellen wurden zusammengefasst und neu formuliert, um ihre
Lizenzbedingungen einzuhalten.
