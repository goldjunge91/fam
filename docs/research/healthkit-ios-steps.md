# Research: `@kingstinct/react-native-healthkit` für iOS-Schrittzähler

Ticket: #271 (blockiert #273 "Health-Integration: HealthKit + Health-Connect Design", zusammen mit #272 für Android/Health-Connect)
Scope: nur Lesezugriff auf Schritte (und optional Active Energy Burned) — keine Rohdaten-Spiegelung, nur ein täglich berechneter Wert landet in `daily_step_counts`.

## Kurzfassung / Empfehlung

**`@kingstinct/react-native-healthkit` ist die richtige Wahl und aktiv genug gepflegt, um es einzusetzen.** Aktuellste Version `14.1.0`, veröffentlicht **2026-08-26** (3 Tage vor dieser Recherche) ([npm registry](https://registry.npmjs.org/@kingstinct/react-native-healthkit)). Repo nicht archiviert, letzter Push identisch mit dem npm-Release-Zeitstempel, 709 GitHub-Stars, 21 offene Issues ohne erkennbaren Show-Stopper für einen reinen Lesezugriff auf Steps/Active Energy ([GitHub API](https://api.github.com/repos/kingstinct/react-native-healthkit)). Peer-Dependencies (`react >=19`, `react-native >=0.79`) passen zu React 19.2 / RN 0.86. Es gibt ein offizielles Expo-Config-Plugin, wodurch `Info.plist`-Einträge deklarativ über `app.json`/`app.config.ts` gesetzt werden — kein manuelles Xcode-Gefrickel nötig. Einziger Wermutstropfen: das Paket zieht zusätzlich `react-native-nitro-modules` als Peer-Dependency nach — beides sind **neue native Dependencies**, die einen Dev-Client-Rebuild erfordern (siehe AGENTS.md-Constraint zu nativen Modulen — kein automatischer Rebuild durch mich, nur Hinweis).

## 1. Release-/Wartungsstand

- Aktuelle Version: **14.1.0**, publiziert **2026-08-26T10:33:10Z** (dist-tag `latest`) — Quelle: `https://registry.npmjs.org/@kingstinct/react-native-healthkit` (npm-Registry-JSON, Feld `time`/`dist-tags`).
- Release-Historie (Auszug, aus derselben Registry-Antwort, Feld `time`):
  - `13.3.0` — 2026-03-09 (Upgrade auf Nitro 0.35.0 laut GitHub-Release-Notes)
  - `13.4.0` — 2026-03-25
  - `14.0.0` — 2026-04-08 (Major: typisierte `metadata` als kanonische API statt flacher Legacy-Felder, SDK-gestützte Schema-Verifikation gegen die gepinnte Xcode-HealthKit-SDK-Version)
  - `14.0.1` — 2026-05-14, `14.0.2` — 2026-06-05
  - `14.1.0` — 2026-08-26 (u. a. Fixes an Background-Observer-Setup, Wiring von Background-HealthKit-Updates nach JS, Serialisierung von Workout-Sub-Activity-Types)
  - Quelle: GitHub Releases (`https://github.com/kingstinct/react-native-healthkit/releases`), Registry-Zeitstempel via npm.
- Repo-Status (GitHub API `https://api.github.com/repos/kingstinct/react-native-healthkit`): `archived: false`, `pushed_at: 2026-08-26T10:33:12Z` (deckungsgleich mit dem npm-Release), `open_issues_count: 21`, `stargazers_count: 709`, Lizenz MIT.
- Offene Issues (Stichprobe über GitHub Search API, sortiert nach Reaktionen/Kommentaren): keines betrifft Steps oder Active Energy im Lesezugriff kritisch. Nennenswert: #274 "memory leak" (8 Kommentare, unklar ob aktuell noch reproduzierbar), #340 "App Crashes on Launch on iOS 26.4 — getSortDescriptors" (1 Kommentar, vermutlich in 14.x behoben), #359 "in-app permission modal stopped showing Blood Pressure on latest iOS 26.5" (betrifft Blood Pressure, nicht Steps). Kein offenes Issue deutet auf einen Blocker für den hier geplanten Use-Case hin.
- Kommerzieller Support/Sponsoring über Kingstinct verfügbar (GitHub Sponsors, Discord) — spricht für Langlebigkeit über Hobby-Projekt-Niveau hinaus.

## 2. Kompatibilität RN 0.86 / React 19.2 / New Architecture

- `peerDependencies` laut npm-Registry (Version 14.1.0): `react: ">=19"`, `react-native: ">=0.79"`, `react-native-nitro-modules: ">=0.35"`. RN 0.86 und React 19.2 erfüllen beide Untergrenzen.
- Das Paket basiert seit Version 13.3.0 vollständig auf **Nitro Modules** (`react-native-nitro-modules`, Margelo) statt der klassischen TurboModule-Codegen. Nitro-Module selbst sind laut Projektdokumentation (`nitro.margelo.com`, über Web-Suche verifiziert) grundsätzlich sowohl unter Old als auch New Architecture lauffähig — nur Nitro *Views* (nicht relevant hier, HealthKit hat keine View-Komponenten) verlangen zwingend New Architecture. Da dieses Projekt ohnehin auf New Architecture läuft (RN 0.86 Default), ist das kein Risiko, nur zur Vollständigkeit vermerkt.
- Fazit: kompatibel. Zusätzliche native Dependency: `react-native-nitro-modules` muss mitinstalliert werden — **das ist eine neue native Abhängigkeit und erfordert einen Dev-Client-Rebuild** (`bash scripts/ios-dev.sh`), analog zur HealthKit-Bibliothek selbst.

## 3. Expo-Integration / Config-Plugin

- Das Paket bringt ein eigenes Expo-Config-Plugin mit. Einbindung laut README (`https://raw.githubusercontent.com/kingstinct/react-native-healthkit/master/README.md`):
  ```json
  {
    "expo": {
      "plugins": ["@kingstinct/react-native-healthkit"]
    }
  }
  ```
  Das Plugin akzeptiert Optionen zur Anpassung von `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` und einer `background`-Option (für Background-Delivery/Observer-Queries). Es setzt automatisch die HealthKit-Capability/Entitlement.
- Für Bare-/native Workflows (falls relevant): `pod-install`, HealthKit-Capability manuell in Xcode aktivieren, ggf. Swift-Bridging-Header ergänzen — für dieses Projekt (Expo-Prebuild via EAS/Dev-Client) ist der Config-Plugin-Pfad einschlägig, keine manuelle Xcode-Arbeit nötig.
- Erfordert zwingend einen Dev Client — funktioniert nicht in Expo Go (deckt sich mit AGENTS.md/CLAUDE.md-Vorgabe: native Module laufen nur im Dev-Client).

## 4. Unterstützte HealthKit-Datentypen (Lesezugriff)

- Laut README deckt die Bibliothek über 100 "Quantity Types" ab (Query/Save/Subscribe), darunter explizit **Steps** (`HKQuantityTypeIdentifierStepCount`) und **ActiveEnergyBurned** (`HKQuantityTypeIdentifierActiveEnergyBurned`) — beide vollständig für Lesezugriff (Query + Subscription/Observer) unterstützt.
- API-Shape (aus README, Promise-basiert + optionale Hooks):
  - Autorisierung: `requestAuthorization(readTypes: string[], writeTypes?: string[])`, z. B. `requestAuthorization(['HKQuantityTypeIdentifierStepCount'])` für reinen Lesezugriff.
  - Einzelwert-Abfrage: `getMostRecentQuantitySample('HKQuantityTypeIdentifierStepCount')`.
  - React-Hook-Variante vorhanden: `useMostRecentQuantitySample(...)` — für den geplanten Use-Case (täglicher Aggregatwert) eher die Statistik-/Sum-Query-Funktionen relevant (z. B. `queryQuantitySamples`/`queryStatisticsForQuantity` je nach exakter API-Version — Details vor Implementierung anhand der TypeScript-Typdefinitionen des installierten Pakets verifizieren, README-Auszug ist nicht vollständig).
  - Wichtiger Hinweis aus dem README: Autorisierung muss vor jedem Datenzugriff angefragt werden, sonst crasht die App ("Make sure that you've requested authorization before requesting data, otherwise your app will crash").

## 5. Permissions / Info.plist

- Laut Apple-Dokumentation (`developer.apple.com/documentation/healthkit/protecting-user-privacy`): **`NSHealthShareUsageDescription` ist der einzige zwingende Key für reinen Lesezugriff.** `NSHealthUpdateUsageDescription` ist nur für Schreibzugriffe nötig — die verbreitete Annahme, dass HealthKit-Lesezugriff immer beide Keys braucht, ist laut dieser Quelle nicht korrekt.
- Das Config-Plugin von `@kingstinct/react-native-healthkit` setzt in der Standardkonfiguration offenbar beide Keys (`NSHealthShareUsageDescription` und `NSHealthUpdateUsageDescription`), lässt sich aber über Plugin-Optionen anpassen. **Empfehlung für dieses Projekt:** da nur gelesen wird (kein Schreiben zurück nach HealthKit, entschieden lt. Ticket-Kontext), sollte nur `NSHealthShareUsageDescription` gesetzt werden, sofern das Plugin dies unabhängig konfigurierbar macht — vor Implementierung an den Plugin-Optionen der installierten Version verifizieren.
- Fehlt der passende Key, crasht die App beim Zugriffsversuch (Apple-Doku + README-Warnhinweis stimmen hier überein).

## 6. Simulator vs. echtes Gerät

- Bestätigt über mehrere unabhängige Quellen (u. a. Apple Developer Forums, `developer.apple.com/forums/thread/692302`; weitere Community-Quellen zu Pedometer/Live Activities): **der iOS-Simulator liefert keine echten HealthKit-Daten** — insbesondere Schrittzähler-/Pedometer-Daten sind im Simulator nicht simulierbar. Für Entwicklung und Tests des Schrittzähler-Feature ist ein **physisches iOS-Gerät zwingend erforderlich**.
- Implikation fürs Projekt: QA/Verifikation dieses Features kann nicht über den Simulator laufen (auch nicht via `agent-device`/`ios-simulator`-Skill), sondern nur auf einem realen Dev-Client-Build auf einem Gerät mit echten HealthKit-Daten (eigene Schritte oder manuell in der Health-App eingetragene Testdaten).

## 7. Alternativen (kurzer Blick)

- `react-native-health` (agencyenterprise) — älteres, weit verbreitetes Paket, aber seit längerem deutlich seltener aktualisiert und ohne Nitro/New-Architecture-natives Rewrite; kein aktives Expo-Config-Plugin-Ökosystem auf demselben Niveau.
- `expo-health-connect`/native Expo-Module für HealthKit existieren nicht offiziell (Expo selbst bietet kein first-party HealthKit-Modul, Stand dieser Recherche).
- Ergebnis: `@kingstinct/react-native-healthkit` bleibt die naheliegendste, aktuellste und am besten für Expo-Config-Plugin-Workflows geeignete Option für dieses Projekt.

## Quellen

- npm-Registry-Metadaten: https://registry.npmjs.org/@kingstinct/react-native-healthkit
- GitHub-Repo-Metadaten (API): https://api.github.com/repos/kingstinct/react-native-healthkit
- GitHub-Issues-Suche (API): https://api.github.com/search/issues?q=repo:kingstinct/react-native-healthkit+is:issue+is:open+sort:reactions-desc
- README (Installation, Config-Plugin, API, Datentypen): https://raw.githubusercontent.com/kingstinct/react-native-healthkit/master/README.md
- GitHub Releases: https://github.com/kingstinct/react-native-healthkit/releases
- Apple HealthKit Privacy-Doku (Info.plist-Keys): https://developer.apple.com/documentation/healthkit/protecting-user-privacy
- Apple Developer Forum (Simulator-Limitation): https://developer.apple.com/forums/thread/692302
- Nitro Modules Architektur-Hinweis (Old-/New-Architecture-Support): https://nitro.margelo.com (via Web-Suche verifiziert, kein direktes README-Zitat möglich — Quelle als Sekundärbestätigung markiert)
