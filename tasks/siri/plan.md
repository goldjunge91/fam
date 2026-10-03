# Implementierungsplan: Siri-Einkaufsliste bei geschlossener App

Status: In Umsetzung. Aktueller Fortschritt und Prüfnachweise stehen in Beads `fam-8zbm`.
Recherche: [Siri-Befunde und Architekturentscheidung](../../docs/architecture/2026-10-03-siri-killed-state-research.md).
Aufgabenverwaltung: Beads, Parent-Bug `fam-8zbm`. Der bestehende Dashboard-Plan in `tasks/plan.md` bleibt unverändert. Gemäß `AGENTS.md` gibt es keine zusätzliche `tasks/todo.md`.

## Ziel

Nach einmaligem Öffnen der App und Anmeldung soll Siri auch bei vollständig geschlossener App mehrere Artikel einer benannten Einkaufsliste hinzufügen. Für die erste Version sind zwei Rückfragen akzeptiert:

> „Füge mehrere Artikel zur Einkaufsliste in fam hinzu.“
>
> Siri: „Welche Artikel?“ — „Wurst, Marmelade und Käse.“
>
> Siri: „Welche Einkaufsliste?“ — „Rewe.“

Die Siri-Extension schreibt alle drei Artikel mit der Rewe-`store_id` in die lokale SQLCipher-Datenbank und Outbox. Die Haupt-App wird dafür nicht gestartet. Nach Netzrückkehr werden die Änderungen synchronisiert. Dieselbe Aktion nimmt auch einen einzelnen Artikel an; eine zweite Einzelartikel-Aktion gibt es nicht. Die Aufgabe ist erst nach einem gesprochenen Test auf einem iPhone bei vollständig geschlossener App erledigt.

Ein Ein-Satz-Befehl mit beliebigen Artikel- und Listennamen ist in dieser ersten Version nicht zugesagt. Siri muss die beiden Werte zuverlässig erfragen.

## Architekturentscheidungen

1. Die vorhandene Siri-Extension wird repariert und erweitert. Der Shopping-Intent und sein `AppShortcutsProvider` wandern aus `targets/siri/_shared/` in den extension-eigenen Ordner. Das untersuchte IPA registriert sie in Haupt-App und Extension; der Plugin-Glob für `_shared` erklärt diese Doppelregistrierung. Ob sie allein den Fehler verursacht, ist noch nicht bewiesen. Ein zweites Target würde zusätzliche Signierungs- und Plugin-Risiken erzeugen.
2. `SiriShoppingDatabase` bleibt der einzige native Writer. Er nutzt bereits App Group, SQLCipher und Outbox. Die Erweiterung löst eine aktive Store-Zeile des aktiven Haushalts eindeutig auf und schreibt alle Artikel samt Outbox und History in einer Transaktion. Merge und Payload berücksichtigen `store_id`.
3. Der Siri-Sprachbefehl wird über Apples `AppShortcutsProvider` registriert und direkt mit Siri gesprochen; ein selbst angelegter Kurzbefehl ist nicht nötig. Eine Aktion nimmt einen oder mehrere Artikel über einen String-Parameter und die Liste als `SiriShoppingStore`-AppEntity entgegen. Die EntityQuery liefert aktive Listen des aktuellen Haushalts aus der lokalen, verschlüsselten Datenbank; beim Schreiben wird die ID erneut gegen Haushalt und Löschstatus geprüft. Alle 17 gesprochenen Phrasen enthalten `\.applicationName`. Die Haupt-App ergänzt in ios.infoPlist den gesprochenen Namen Famm sowie die drei erlaubten Synonyme „Fam App“, „Fam Einkauf“ und „Fam Liste“. Allgemeine Begriffe und Namen anderer Apps sind keine Synonyme.
4. Unklare Artikelsegmentierung, fehlende oder mehrdeutige Listen und fehlende App-Group-Voraussetzungen führen zu einer verständlichen Fehlermeldung ohne Teil-Write. Aufzählungen mit Komma, Semikolon oder „und“ sind der erste unterstützte Eingabebereich.
5. Nach der Target-Verschiebung wird die Xcode-Zuordnung mit einem clean prebuild geprüft. Der einzige geplante native Geräte-Build folgt erst nach allen statischen Prüfungen. Weitere Builds setzen einen konkreten Fehlerbefund voraus.

Nicht im Umfang: neues Datenbankschema, Migrationen, native Pakete, Entitlements ohne Befund, zweite SiriKit-Extension, iOS-27-App-Schema, UI-Umbau und Änderungen an der JavaScript-Sprachfunktion.

## Aufgaben und Abhängigkeiten

Die Beads sind die einzige Aufgabenliste. Jeder Bead enthält Beschreibung, prüfbare Akzeptanzbedingungen, Verifikation, voraussichtliche Dateien und Schätzung. Die Reihenfolge ist seriell, weil mehrere Schritte denselben nativen Writer ändern.

| Schritt | Bead | Ergebnis | Abhängig von |
| --- | --- | --- | --- |
| 1 | `fam-8zbm.1` | Intent und Provider nur der Extension zuordnen | nichts |
| 2 | `fam-8zbm.2` | Gesprochenen Listennamen im aktiven Haushalt eindeutig auflösen | `.1` |
| 3 | `fam-8zbm.3` | **Checkpoint A:** Target-Zuordnung und Store-Grenze statisch prüfen | `.2` |
| 4 | `fam-8zbm.4` | Mehrere Artikel atomar in eine Liste schreiben | `.3` |
| 5 | `fam-8zbm.5` | Einen oder mehrere Artikel per Siri mit zwei Rückfragen hinzufügen | `.4` |
| 6 | `fam-8zbm.6` | **Checkpoint B:** alle statischen Qualitätsprüfungen bestehen | `.5` |
| 6a | `fam-8zbm.8` | Artikelparser mit Swift Testing abdecken | `.6` |
| 6b | `fam-8zbm.9` | Produktionsschreiber und iOS-Verfügbarkeiten mit Swift Testing abdecken | `.6` |
| 7 | `fam-8zbm.7` | **Geräteabnahme:** ein Build und Killed-State-Test auf dem iPhone | `.6`, `.9` |

Der Parent-Bug `fam-8zbm` bleibt offen, bis Schritt 7 mit geschlossener App bestanden ist.

## Prüfpunkte

**Checkpoint A nach Schritt 1–2:** Gezielte Tests mit `bun run test <datei>`. Das generierte Projekt wird nach `bash scripts/local-build-env.sh -- bun x expo prebuild --clean --platform ios` auf Target-Mitgliedschaft geprüft: Shopping-Intent und Provider dürfen nur `siri.appex` zugeordnet sein. Vor dem prebuild werden laufende Builds und generierte iOS-Dateien geprüft. Das prebuild ist noch kein Geräte-Build.

**Checkpoint B nach Schritt 4–5:** Nur betroffene Tests mit `bun run test <datei>`, danach `bun run check`, `bun run typecheck`, Swift-Syntaxprüfung und `git diff --check`. Quelltests ersetzen weder Swift-Typcheck noch eine echte Siri-Ausführung. Die native Kompilierung folgt im abschließenden Build. Ohne weitere Änderung der Target-Zuordnung ist kein zweites clean prebuild geplant.

Parser und Datenbankschreiber werden mit Apples Swift-Testing-Framework geprüft. Das SwiftPM-Paket setzt iOS 17 als Mindestversion und kompiliert den echten Siri-Intent samt Writer. Die iOS-26-Eigenschaft `supportedModes` ist mit Availability-Checks geschützt. SwiftPM-Ausgaben und Modulcache liegen unter `/Volumes/Programme/temp_bin/fam-siri-swift-tests`; der gezielte Aufruf lautet:

```sh
mkdir -p /Volumes/Programme/temp_bin/fam-siri-swift-tests/tmp /Volumes/Programme/temp_bin/fam-siri-swift-tests/module-cache
SWIFTPM_MODULECACHE_OVERRIDE=/Volumes/Programme/temp_bin/fam-siri-swift-tests/module-cache TMPDIR=/Volumes/Programme/temp_bin/fam-siri-swift-tests/tmp swift test --disable-sandbox --manifest-cache none --package-path . --scratch-path /Volumes/Programme/temp_bin/fam-siri-swift-tests/build --filter SiriShoppingDatabaseWriteTests
```

`swift test` führt die Swift-Tests auf dem Mac aus. Die aktuelle Installation hat nur den iOS-26.2-Simulator, keine iOS-17- oder iOS-18-Runtime; eine Ausführung auf diesen älteren Laufzeiten wird deshalb nicht behauptet. Die Versionsgrenze wird im Swift-Paket und durch Availability-Checks abgesichert. App-Intents-Laufzeit, Kurzbefehle, Spotlight und Siri bleiben Teil der Geräteabnahme.

**Swift-Tests für iOS 17–26:** Die Parser-Tests prüfen Trennzeichen, Leerraum,
ungültige Eingaben und Längengrenzen. Die Writer-Tests rufen
`SiriShoppingDatabase.write` direkt mit einer In-Memory-SQLite-Datenbank und
den Tabellen aus den lokalen Migrationen auf. Sie prüfen Listen- und
Haushaltsgrenzen, Zusammenführen vorhandener Artikel, Outbox/History sowie
vollständigen Rollback bei einem Fehler mitten im Batch und bei mehrdeutigen
Listennamen. Der SwiftPM-Fallback verwendet System-SQLite; das iOS-Target
verwendet weiterhin `ExpoSQLite`.

Die Apple-API `AppIntentsTesting` ist für diese iOS-Versionen nicht verfügbar
und wird weder in die App-Konfiguration noch in ein XCUITest-Target eingebaut.
Die Swift-Tests prüfen Parser und Schreibverhalten, aber nicht die Erkennung
durch Siri oder die App-Intents-Laufzeit. Dafür gelten weiterhin Apples
Shortcuts-, Spotlight- und Siri-Prüfschritte unten sowie die Geräteabnahme.

**Systemprüfungen nach Apples Verifikationsablauf:**

1. **Shortcuts:** Unter fam in der Action Library muss die Aktion für mehrere
   Artikel erscheinen. Parameterzusammenfassung und deutsche Titel müssen
   natürlich lesbar sein. `Artikel` und `Einkaufsliste` mit gültigen,
   fehlenden, ungültigen, gelöschten und mehrdeutigen Werten prüfen. Dialog,
   Zahl der hinzugefügten Artikel und den verkettbaren Anzahl-Rückgabewert
   prüfen. Eine benutzerdefinierte Kurzbefehlsfolge auch mit einer Aktion aus
   einer anderen App ausführen.
2. **Spotlight:** Die Phrasen der App Shortcuts durch Eintippen auf einem
   iPhone als Vorschläge prüfen. Die dynamische Einkaufslisten-Entität in
   Kurzbefehlen auf passende Namenssuche und aktuelle Haushaltslisten prüfen.
3. **Siri:** Auf dem iPhone natürliche deutsche Varianten mit Füllwörtern,
   den App-Namen und den freigegebenen fam-Synonymen sprechen. Beide
   Rückfragen, Liste und alle Artikel verifizieren. Den Ablauf bei sichtbarer
   fam-App und bei geschlossener App prüfen. Kontextverweise wie „diese“ oder
   „jene“ sind nicht anwendbar, solange der Intent keine Entität bzw.
   View-Annotation bereitstellt. Einen App-übergreifenden Siri-Ablauf, den
   gesprochenen Erfolg mit AirPods ohne sichtbaren Bildschirm und jede von
   fam für Siri unterstützte Sprache prüfen.

Die Shortcuts-, Spotlight- und Siri-Systemprüfungen sind Handprüfungen und
werden separat von den Swift-Unit-Tests protokolliert. Sie sind noch offen.

**Geräteabnahme:** Ein lokales TestFlight-IPA wird mit `bash scripts/eas-ios-build.sh local preview-testflight-local` erzeugt. Diesen neuen Build starte ich erst nach ausdrücklicher Freigabe; einen laufenden Build stoppe oder starte ich nicht neu. Ein nötiger Upload bleibt ein gesonderter Freigabeschritt. Die App-Intent-Metadaten werden verglichen; CFBundleSpokenName und die drei Synonyme müssen in der Haupt-App-Info.plist stehen. Auf dem iPhone wird die App vollständig beendet. Der Nutzer probiert mehrere einfache Siri-Sätze mit `fam`, `Fam App`, `Fam Einkauf` und `Fam Liste`, fügt damit einmal einen einzelnen und einmal mehrere Artikel hinzu und beantwortet beide Rückfragen. Die Antwort auf „Welche Einkaufsliste?“ muss übernommen werden, ohne dieselbe Listenfrage erneut zu stellen. Prozess-Logs müssen zeigen, dass die Extension schreibt, ohne die Haupt-App zu starten. Bei bekanntem Ausgangszustand werden Rewe-Liste, Outbox und Synchronisierung nach Netzrückkehr geprüft. Ein Fehlschlag bei geschlossener App blockiert die Abnahme auch bei grünem Build.

Die vollständige Jest-Suite und `bun test` werden nicht ausgeführt. Buildnummern werden nur über den EAS-Mechanismus gesetzt. Temporäre Dateien und Caches bleiben in den projektseitig erlaubten Pfaden.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Doppelregistrierung ist nicht die einzige Fehlerursache | Siri scheitert weiter bei geschlossener App | IPA-Metadaten und Prozess-Logs auswerten, dann gezielt korrigieren |
| Siri transkribiert ohne klare Trenner | Ein falscher Artikel entsteht | Rückfrage mit erkennbarer Aufzählung; unklare Eingabe ohne Write melden |
| Liste fehlt, ist gelöscht oder gehört zu anderem Haushalt | Falsches Ziel | Aktiven Haushalt, `deleted_at` und Eindeutigkeit vor dem Write prüfen |
| Ein Batch-Schritt scheitert | Teilweise Daten oder Outbox | Eine Transaktion mit Rollback und gezieltem Fehlerfall |
| Dateischutz verhindert den Zugriff bei gesperrtem Gerät | Extension kann nicht schreiben | Gesperrten Zustand am Gerät testen und Voraussetzung verständlich melden |
| Native Builds dauern lange | Langsame Fehlerschleife | Target früh prüfen, statisches Gate vor dem einzigen geplanten Build |

## Offene technische Nachweise

Die deutschen Siri-Rückfragen, die Erkennung des Anzeigenamens und der drei Synonyme, der genaue Ausführungsprozess und der Zugriff bei gesperrtem Gerät sind erst am iPhone beweisbar. Sie sind verbindliche Geräteprüfungen, keine Gründe für zusätzliche Architektur vor dem nächsten Build. Zwei Rückfragen sind akzeptiert, die geschlossene App ist Pflicht.
