# Siri - Recherche, Entscheidung und Umsetzungsplan (2026-10-03)

Status: **Architekturentscheidung; Implementierung im Workspace, Geräteabnahme offen.** Ziel: Siri
soll mehrere Artikel einer benannten Einkaufsliste hinzufügen, **ohne dass die
Haupt-App laufen oder gestartet werden muss**. Eine Siri-Rückfrage nach den
Artikeln und eine zweite nach der Liste sind akzeptabel. **Korrigierter
Nutzerbefund:** Der bestehende Siri-Weg funktioniert nur, wenn die App noch
läuft; bei beendeter App scheitert er. Der Nutzer erlaubt nun, die vorhandene
Implementierung weiterzuentwickeln, wenn das weniger Fehlerquellen und native
Builds als ein neues Target erzeugt. Genau das ist die Empfehlung.

## Kurzfassung

- Der Einkaufslisten-Intent ist im untersuchten IPA in **beiden** Targets
  registriert (Haupt-App und `siri`-Extension). Das war eine mögliche Erklärung
  für den Killed-State-Fehler, ist aber als alleinige Ursache noch nicht
  bewiesen. Der Nutzer bestätigt den Fehler für die aktuelle Nutzung. Build 74
  entstand vor dem jüngsten Split, daher belegt er nicht die Metadaten eines
  neuen Builds aus dem aktuellen Quellstand.
- **Neue Empfehlung:** Das bestehende Siri-Target reparieren. Intent und
  `AppShortcutsProvider` sollen aus `_shared` in den Extension-eigenen
  Target-Ordner umziehen, damit sie nicht mehr in der Haupt-App registriert
  werden. Die bestehende Einzelartikel-Funktion bleibt nach der Reparatur
  erhalten; Mehrfachartikel und Listenauswahl kommen im selben Target dazu.
  Neue Bundle-ID, Provisioning und A/B-Builds entfallen.
- Der gewünschte Artikeltext ist ein offener Siri-Parameter. Ein App Shortcut
  kann ihn laut Apple nicht verlässlich aus der ersten Äußerung übernehmen;
  dafür dient die akzeptierte Rückfrage. Ein bereits bekannter Ladenname kann
  als App-Entität in einer parametrisierten Phrase stehen.
- Die Entitlement `com.apple.developer.siri` fehlt im gebauten IPA, ist aber als
  Ursache des Killed-State-Bugs **nicht belegt** (siehe Abschnitt Entitlement).
- Ein zweites `app-intent`-Target kann mit der installierten Plugin-Version das
  vorhandene Target wiederverwenden. Das verstärkt die Entscheidung für den
  vorhandenen Pfad und gegen eine zweite Extension. Alle statischen Prüfungen
  sollen vor **einem** neuen nativen Geräte-Build laufen.

## Kontext & Architektur

- Expo SDK 57, React Native 0.86. Paketmanager `bun`.
- Extension-Target `targets/siri/` (`type: "app-intent"`, ExtensionKit,
  `com.apple.appintents-extension`), registriert via `@bacons/apple-targets`.
- Dateien:
  - `targets/siri/siri-extension.swift` - `@main struct FamAppIntentsExtension`
  - `targets/siri/siri-shopping-list-intents.swift` - `AddShoppingListItemsIntent`
    und Store-Entity-Abfrage
  - `targets/siri/siri-shopping-list-database.swift` und
    `targets/siri/siri-shopping-list-database-writer.swift` - SQLCipher-Zugriff
    auf `fam-v2.db` im App-Group-Container und atomarer Writer
  - `targets/siri/SiriShoppingItemParser.swift` - Mehrfachartikel-Parser
  - `targets/siri/main-app-shopping-list-intent.swift` -
    `FamMainAppShortcuts: AppShortcutsProvider` im Extension-Target
- App-Seite: `database-key-file-store.ts` (Schlüsseldatei), `active-household-store.ts`
  (Kontextdatei), `shared-app-group.ts`; DB im App-Group-Container.
- Erwartungsgrenze: DB, Schlüssel und Haushaltskontext existieren erst nach
  einmaligem App-Öffnen.

## Belegte Befunde

### 1. Doppel-Registrierung in App + Extension (IPA)

- Geprüft: `build/local/eas/preview-testflight-local/build-1790986068689.ipa`
  (Build 74, 02:07).
- `Payload/fam.app/Metadata.appintents/extract.actionsdata`
  - `autoShortcutProviderMangledName: 3fam19FamMainAppShortcutsV`
  - Actions: `AddShoppingListItemIntent`, 4 Phrasen.
- `Payload/fam.app/Extensions/siri.appex/Metadata.appintents/extract.actionsdata`
  - `autoShortcutProviderMangledName: 4siri19FamMainAppShortcutsV`
  - Actions: `AddShoppingListItemIntent`, 4 Phrasen.
- Ursache: `@bacons/apple-targets` bindet `_shared/*` automatisch an Haupt-App **und**
  Extension (`node_modules/@bacons/apple-targets/build/with-xcode-changes.js`,
  `_shared`-Glob).
- Verzögerung: Build 74 (02:07) entstand VOR dem Split-Commit `01b3e6e1` (02:32).
  Der getestete Build enthielt den Split noch nicht. Im aktuellen Quellstand
  liegen Intent und Provider direkt unter `targets/siri/` und damit im
  Extension-Target. Die neue Target-Zuordnung muss im generierten Projekt und
  in den Metadaten eines neuen IPA bestätigt werden.

### 2. Apple: Provider + Intents im selben Target

- [Apple WWDC23, Session 10103](https://developer.apple.com/videos/play/wwdc2023/10103/):
  App Shortcuts können seit iOS 17 in der **App-Intents-Extension** definiert
  werden. Zuvor mussten sie im App-Bundle stehen; dann wurde die App bei der
  Ausführung im Hintergrund gestartet.
- Apples [App-Shortcuts-Dokumentation](https://developer.apple.com/documentation/appintents/app-shortcuts)
  erlaubt den `AppShortcutsProvider` im App-Bundle, in einer App-Extension,
  einem Swift-Paket oder einer Bibliothek. Die
  [App-Extension-Dokumentation](https://developer.apple.com/documentation/appintents/app-extension)
  beschreibt die App-Intents-Extension ausdrücklich als Ausführungsort für
  Intents, wenn die Haupt-App nicht läuft. Provider und Intent dürfen daher
  gemeinsam im Extension-Target `targets/siri/` liegen; der Dateiname
  `main-app-shopping-list-intent.swift` ändert die Target-Zuordnung nicht.
- Diese Target-Wahl ist hier beabsichtigt: Dateien direkt unter
  `targets/siri/` gehören laut der installierten
  [`@bacons/apple-targets`-Dokumentation](../../node_modules/@bacons/apple-targets/README.md)
  zur Extension. Dateien unter `targets/siri/_shared/` werden zusätzlich ins
  Haupt-App-Target aufgenommen und erzeugten im untersuchten IPA doppelte
  Shortcut-Metadaten. Der Provider im Extension-Target ermöglicht, dass Siri
  die Aktion bei geschlossener Haupt-App ausführt; er verlangt keinen Start der
  Haupt-App.
- Apple DTS: `AppIntentsPackage` in mehreren Targets kann zu **duplikaten Metadata**
  führen -> OS kann Intent zur Laufzeit nicht auflösen.
- Forum/StackOverflow-Threads mit identischem Fehlerbild:
  - `LNActionForAutoShortcutPhraseFetchError Code=1 "Couldn't find AppShortcutsProvider"`
  - Auftritt nur, wenn die App beendet ist.
  - Fix in diesen Threads: Intent/Provider aus dem zweiten Target entfernen.

### 3. Entitlement `com.apple.developer.siri` (offen)

- **Nicht** im IPA vorhanden (weder App noch Extension) - per `codesign -d
  --entitlements :-` geprüft.
- [Apple Siri Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.siri):
  Das App-Store-Erfordernis bezieht sich ausdrücklich auf Intents-Extensions,
  die andere Siri-Anfragen als Shortcut-Anfragen bearbeiten. Für den reinen
  App-Shortcut-Pfad folgt daraus kein belegter Fix.
- `ajsutton/moolah-native` Issue #88: „com.apple.developer.siri entitlement absent
  for AppIntents usage“ - fix in PR #141, aber Kommentar „Requirement has evolved for
  pure-AppIntents on iOS 26; worth verifying“.
- **Einordnung:** nicht als Ursache des Killed-State-Bugs verkaufen; ggf. separater
  App-Review-Punkt (Guideline 2.5.4).

### 4. iOS-Versionsgrenzen

- `allowedExecutionTargets` (Prozess erzwingen: App vs. Extension) erst ab
  iOS 27/Xcode 27; auf iOS 26 nicht verfügbar.
- `openAppWhenRun` ist deprecated (Nachfolger `supportedModes`).
- Deployment-Target des Targets: `17.0` (siehe `targets/siri/expo-target.config.js`).

### 5. Weitere Apple- und Expo-Quellen

- [Apple WWDC22, App Shortcuts](https://developer.apple.com/videos/play/wwdc2022/10170/):
  Phrasen mit vorab bekannten Entitäten sind möglich; freie String-Werte werden
  nicht aus der ersten Äußerung erfasst. Siri kann den Wert per Rückfrage
  aufnehmen. Parametrisierte Phrasen stehen erst bereit, nachdem die App die
  Werte bereitgestellt hat.
- [Apple WWDC25, App Intents](https://developer.apple.com/videos/play/wwdc2025/244/):
  App-Shortcut-Phrasen enthalten den App-Namen und höchstens einen
  Intent-Parameter. Deshalb kann der Startsatz etwa die Rewe-Liste auswählen,
  aber nicht zugleich eine beliebige Artikelfolge als zweiten Parameter
  aufnehmen.
- [Apple: Entitäten und String-Abfragen](https://developer.apple.com/documentation/appintents/entity-queries):
  `EntityStringQuery` kann gesprochene Listennamen gegen vorhandene Entitäten
  auflösen. Die eigentliche Haushaltsgrenze muss der lokale Datenzugriff
  durchsetzen.
- [Apple: App-Intent-Verifikation](https://developer.apple.com/documentation/appintents/verifying-your-app-intents-implementation):
  Shortcut-Editor, Metadaten und Quelltests ersetzen keinen Siri-Sprachtest mit
  tatsächlich gesprochenen Phrasen auf dem Gerät.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) und
  [Expo-Dokumentationsindex](https://docs.expo.dev/llms.txt): Das Projekt nutzt
  Expo `~57.0.26`, React Native `0.86.3` und einen generierten nativen
  iOS-Build. Ein Swift-Target-Wechsel erfordert einen neuen nativen Build.
- [Apple SiriKit: Listen und Notizen](https://developer.apple.com/documentation/sirikit/lists-and-notes):
  Der ältere `INAddTasksIntent` kann mehrere Titel und eine Zielliste tragen,
  ist aber Legacy-Unterstützung und deckt die neuen Siri-AI-Interaktionen
  nicht ab. Wegen der akzeptierten Rückfrage ist ein zweites SiriKit-Target
  für dieses Vorhaben nicht gerechtfertigt.
- [Apple Reminders-App-Schema](https://developer.apple.com/documentation/appintents/appschema/remindersintent/createreminder):
  Der iOS-27-Weg beschreibt einen einzelnen Reminder mit optionaler Liste und
  ist als Beta dokumentiert. Er belegt keinen zuverlässigen Ein-Satz-Befehl
  für drei beliebige Einkaufsartikel. Daher vorerst kein Teil dieses Plans.

### 6. Weitere geprüfte externe Quellen

- `https://www.kwakye-gyamfi.com/posts/2026-03-28-ios-intents-expo`
  - Komplett gelesen. Muster: Intents + Provider im **Haupt-App-Target** (eigenes
    Expo-Modul + Config-Plugin, App Groups). Nützlich als Kontrast, aber nicht für
    Killed-State - exakt das Muster, das im Killed-State scheitern kann.
- `https://gustash.github.io/react-native-siri-shortcut/` (README gelesen)
  - Legacy iOS-12-SiriKit (`NSUserActivity`-Donation). Nicht für App Intents.
- `https://github.com/gustash/react-native-siri-shortcut` (README gelesen, s.o.)
- `https://github.com/jaimeagudo/react-native-siri-shortcut` (README gelesen)
  - „very early stages“, ungepflegt; kein Kandidat.

Die zuvor offenen Überblicksseiten zu SiriKit und App Intents wurden durch die
oben verlinkten spezifischen Apple-Dokumente ergänzt. Die Verfügbarkeit und
Spracherkennung des konkreten deutschen Satzes bleibt ein Gerätetest.

## Plugin-Mechanik (`@bacons/apple-targets`)

- `_shared/*` wird automatisch an Haupt-App + Extension gehängt -> Ursache der
  Duplikation. Ein `targets/_shared` (global) würde in ALLE Targets wandern (auch
  `watch`) - nicht nutzen.
- Bundle-ID eines Extension-Targets wird aus dem **Typ** abgeleitet
  (`com.goldjunge91.fam1.app-intent`), NICHT aus dem Ordnernamen. Ein zweites
  `app-intent`-Target kollidiert also mit `siri`, solange keine explizite
  `bundleIdentifier` gesetzt wird.
- Mit expliziter `bundleIdentifier` (z. B. `.siri-next`) entsteht eine neue App-ID
  mit eigenem Provisioning. Das ist für einen getrennten Extension-Build nötig,
  reicht aber **nicht** für zwei gleichartige Targets in einem Build. Dieser
  Ansatz wird wegen des zusätzlichen Build- und Signierungsaufwands verworfen.
- `with-xcode-changes.js` wählt ein vorhandenes Target zunächst per
  `productName`, fällt aber sonst auf `targets[0]` desselben Typs zurück.
  Ein zweiter `app-intent`-Ordner kann so das erste Target **aktualisieren**,
  statt ein zweites anzulegen. Das wäre eine zusätzliche Fehlerquelle.
- Die installierte Plugin-Version besitzt bereits die Optionen `root` und
  `match` für die Target-Auswahl (`build/config-plugin.js`). Das könnte zwei
  Build-Varianten ermöglichen, würde aber Build-Konfiguration und Prebuild-
  Zustände verkomplizieren. Es wird für diese Umsetzung nicht genutzt.

## Entscheidung und Zielablauf

Die neue Nutzeranweisung erlaubt Änderungen am vorhandenen Siri-Code. Da der
aktuelle Weg nur bei laufender App funktioniert und ein neuer Target-Pfad
zusätzliche Fehlerquellen erzeugt, wird **das bestehende `targets/siri/`
repariert und erweitert**:

1. `siri-shopping-list-intents.swift` und der `FamMainAppShortcuts`-Provider
   werden aus `targets/siri/_shared/` in den Extension-eigenen Ordner
   `targets/siri/` verlagert. Die bestehenden Typen und Phrasen bleiben zunächst
   erhalten. Der Plugin-Mechanismus soll sie danach ausschließlich an die
   Extension binden. Die Haupt-App erhält keinen Shopping-Intent mehr.
2. Die bestehende Einzelartikel-Aktion bleibt nutzbar. Für mehrere Artikel und
   eine benannte Liste wird eine unterscheidbare Aktion im selben Provider
   ergänzt. Beide Aktionen verwenden denselben nativen Datenbank-Owner; keine
   zweite 632-Zeilen-Kopie und kein weiteres Target.
3. Die erste Version nutzt zwei Siri-Rückfragen. Damit sind weder eine neue
   App-Entität für `stores` noch ein Mechanismus zum Aktualisieren
   parametrisierter Phrasen nötig. Der native Writer löst den gesprochenen
   Listennamen gegen aktive `stores` des aktiven Haushalts auf.
4. Nach der Target-Verschiebung wird das generierte Xcode-Projekt durch ein
   einmaliges clean prebuild geprüft. Die einzige teure native
   Geräte-Buildrunde erfolgt erst nach Code-Review, fokussierten Tests,
   Typecheck und Biome-Prüfung. Ein zusätzlicher Ausgangsbuild ist nicht
   vorgesehen: Der Nutzerbefund und das frühere IPA liefern die Ausgangslage.

Geplanter Ablauf nach einmaligem App-Start und Anmeldung:

> „Siri, füge mehrere Artikel zur Einkaufsliste in fam hinzu.“
>
> Siri: „Welche Artikel?“
>
> „Wurst, Marmelade und Käse.“
>
> Siri: „Welche Einkaufsliste?“
>
> „Rewe.“

Die genaue Reihenfolge der Rückfragen ist ein Gerätetest. Die Phrase enthält
`\(.applicationName)` und keine offenen Werte. Dadurch muss Siri keine freien
Artikel- oder Listennamen aus dem ersten Satz extrahieren. Bei unklaren
Artikeln oder nicht eindeutig passender Liste erfolgt **kein** Datenbank-Write.

## Umsetzungsreihenfolge und Abnahme

Die Aufgabenverwaltung erfolgt beim Implementierungsstart in Beads; dieser
Abschnitt ist die Architektur- und Abnahmebasis, keine parallele Aufgabenliste.
Der vorhandene Bug `fam-8zbm` beschreibt den Killed-State-Fehler.

| Schritt | Arbeit und Grenze | Abnahme |
| --- | --- | --- |
| 1. Target-Zuordnung | Den vorhandenen Intent und Provider in den Extension-eigenen Ordner verlagern; `@main`, Bundle-ID, App Group, Schlüsselpfad und Einzelartikel-Verhalten beibehalten. Die Siri-Convention-Tests anpassen. | Das nach `expo prebuild --clean` generierte Xcode-Projekt ordnet Shopping-Provider und Intent nur `siri.appex` zu. Die extrahierten Metadaten werden nach Schritt 5 am gebauten IPA geprüft. |
| 2. Listenauswahl | Eine String-Rückfrage nach der Einkaufsliste ergänzen. Die native Abfrage akzeptiert nur eine eindeutige, nicht gelöschte `stores`-Zeile des aktiven Haushalts und setzt deren ID als `store_id`. | Rewe wird eindeutig getroffen; fremde, fehlende oder mehrdeutige Listen erzeugen einen Fehler ohne Schreibvorgang. |
| 3. Mehrfachartikel | Den Antworttext mit klaren Trennzeichen in Artikel zerlegen. Alle Artikel in **einer** SQLite-Transaktion samt Outbox und History schreiben; Merge nur innerhalb derselben Liste. Die Einzelartikel-Aktion bleibt bestehen. | Drei Artikel für „Wurst, Marmelade und Käse“; Mehrwortnamen, Dubletten und ein Fehler mitten im Batch sind geprüft. Ein Batch ist vollständig oder gar nicht gespeichert. |
| 4. Statische Freigabe | Nur betroffene Tests mit `bun run test <datei>` ausführen, dazu `bun run check`, `bun run typecheck`, Swift-Syntaxprüfung und Diff-Review. Die Target-Zuordnung wurde bereits nach Schritt 1 durch ein einmaliges `expo prebuild --clean` im generierten Projekt kontrolliert. | Alle deterministischen Prüfungen grün; nur vorhandenes Siri-Target, keine neuen Entitlements oder nativen Pakete; keine unerwarteten Projektänderungen. |
| 5. Gerätefreigabe | Einen installierbaren iOS-Build erzeugen und dessen App-Intent-Metadaten in Haupt-App und Extension vergleichen. **App vollständig schließen**, Siri-Satz sprechen, Rückfragen beantworten und danach Liste sowie Outbox-Sync prüfen. Dabei die Prozess-Logs kontrollieren. Auch die alte Einzelartikel-Phrase und Offline-Nutzung prüfen. | Die Metadaten registrieren Shopping-Provider und Intent nur in `siri.appex`. Siri schreibt bei vollständig geschlossener App über den Extension-Prozess, ohne die Haupt-App zu starten. Rewe enthält genau die drei Artikel, lokal sofort und nach Netzrückkehr synchronisiert. Die Einzelartikel-Aktion funktioniert weiterhin. |

**Harte Freigabegrenze:** Solange Schritt 5 bei vollständig geschlossener App
scheitert, ist die Siri-Aufgabe nicht erledigt. Bei Fehlschlag werden zuerst
Ausführungsprozess, Metadaten, Entitlements und App-Group-Zugriff untersucht.
Weitere native Builds erfolgen nur auf Basis eines konkreten Fehlers, nicht
für weitere Varianten auf Verdacht. Das fehlende Siri-Entitlement wird nur dann
geändert, wenn ein Signierungs- oder Laufzeitbefund es verlangt.

## Fachliche und technische Risiken

- Siri kann aus „Wurst Marmelade Käse“ ohne Trennwörter keinen eindeutigen
  Artikelumfang garantieren. Die Rückfrage fordert eine erkennbare Aufzählung;
  die tatsächlich transkribierte Antwort wird auf dem Gerät geprüft. Der
  bestehende TypeScript-Parser unter `src/features/shopping-list/stt-beta/`
  liefert Testfälle und fachliche Erwartungen, läuft aber nicht im nativen
  Extension-Prozess.
- Der native Writer setzt derzeit `store_id = null` und führt nur eine
  Einzelartikel-Transaktion aus. Bei der Erweiterung müssen Merge-Abfrage,
  Insert/Update, Outbox-Payload und Sortierung denselben Listenbezug tragen.
  Lokale SQLite- und Supabase-Schemata besitzen `store_id` bereits; eine
  Migration ist nach heutigem Befund nicht nötig.
- App-Group-Datenbank, Schlüsseldatei und aktiver Haushalt entstehen erst nach
  dem ersten App-Start. Die Extension muss fehlende Voraussetzungen sichtbar
  melden. Dateischutz im gesperrten Zustand und das Entfernen des Kontextes
  beim Logout werden im Gerätetest geprüft.
- Das Verschieben der Swift-Dateien verändert die Xcode-Target-Zuordnung.
  Deshalb muss das generierte Projekt nach `expo prebuild --clean` geprüft
  werden. Vorhandene selbst erstellte Shortcuts können auf eine frühere
  Action-Identität verweisen; sie werden im Gerätetest mitgeprüft.
