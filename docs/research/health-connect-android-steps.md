# Research: Health-Connect-Integrationsoptionen für Android-Schrittzähler

Ticket: #272. Blockiert #273 ("Health-Integration: HealthKit + Health-Connect Design"), parallel zu #271 (HealthKit/iOS, eigener Branch `research/healthkit-ios-steps`).

Frage: Community-Modul (`react-native-health-connect` o.ä.) oder eigenes minimales Expo-Modul für Lesezugriff auf `StepsRecord` unter Expo SDK 57 / Dev Client?

## Empfehlung

**Community-Paket `react-native-health-connect` verwenden, kein Eigenbau.** Es ist aktiv gepflegt, bringt seit v4 ein eigenes Expo-Config-Plugin mit (keine separate `expo-health-connect`-Abhängigkeit mehr), unterstützt laut eigenem README explizit sowohl Old- als auch New Architecture, und deckt exakt den benötigten Use-Case (Permissions, `readRecords`/`aggregate` für `StepsRecord`, SDK-Status-Check, Play-Store-Weiterleitung) ohne natives Kotlin selbst schreiben zu müssen. Ein Eigenbau würde denselben Funktionsumfang duplizieren (Config Plugin, `HealthConnectClient`-Wrapper, Turbo-Module-Spec, Permission-Delegate in `MainActivity`), ohne einen erkennbaren Vorteil zu bieten — reiner Mehraufwand ohne Nutzen (YAGNI).

## Community-Paket: `react-native-health-connect`

- **Registry:** <https://www.npmjs.com/package/react-native-health-connect> — aktuelle Version `4.1.3`, veröffentlicht 2026-08-06 (npm-Registry-Metadaten, Feld `time`).
- **Repo:** <https://github.com/matinzd/react-native-health-connect> — 414 Stars, `pushed_at` 2026-08-26 (also 3 Tage vor dieser Recherche), 53 offene Issues, nicht archiviert (`gh api repos/matinzd/react-native-health-connect`).
- **Release-Kadenz:** v4.0.0 bis v4.1.3 allein zwischen 2026-08-01 und 2026-08-06 (5 Releases in 5 Tagen) — aktive Weiterentwicklung, kein verwaistes Paket (`gh api .../releases`).
- **Offene Issues:** Keine kritischen Blocker zu New Architecture oder RN-0.86-Kompatibilität gefunden (Suche über `gh api search/issues` nach "new architecture"/"expo plugin" im Titel/Body ergab nur ältere, gelöste Themen — z. B. #115 "Expo 48 plugin not working" und #29 "@expo/config-plugins@6.0.2"-Issue mit `expo doctor`, beide **closed**). Offene Issues betreffen primär Datenqualität einzelner Record-Typen (leere Arrays bei `ActiveCaloriesBurned`, `ElevationGained`, Exercise-Distanz) — nicht `StepsRecord`/Permissions/Grundfunktion.
- **Peer-Dependencies:** `package.json` (Quelltext, `master`-Branch) deklariert `"react": "*"`, `"react-native": "*"`, `"expo": "*"`, `"@expo/config-plugins": ">= 6.0.2"` — keine Versions-Obergrenze, die RN 0.86 ausschließen würde.
- **New Architecture:** README-Abschnitt "Features" listet explizit "Supports both old and new architecture ✅"; `package.json` hat `codegenConfig` (`RNHealthConnectSpec`, TurboModule-Spec unter `src/`) — technisch als TurboModule implementiert, kompatibel mit New Architecture (Standard in Expo SDK 57 / RN 0.86).
- **Expo-Support:** Seit v4 ist die Expo-Integration **im Hauptpaket** enthalten (vormals eigenes `expo-health-connect`-Paket, jetzt deprecated). Nutzung: Config Plugin `"react-native-health-connect"` in `app.json`/`app.config.js` plus `expo-build-properties` für `compileSdkVersion`/`targetSdkVersion` 36 und `minSdkVersion` 26, danach `expo prebuild` + Dev-Client-Rebuild (`eas build --profile development --platform android` laut README, im Projekt äquivalent `bash scripts/ios-dev.sh`-Pendant für Android). Kein manueller `MainActivity`-Patch nötig — der Permission-Delegate wird vom gebündelten Expo-Modul automatisch registriert (Quelle: README, Abschnitt "Expo installation", <https://github.com/matinzd/react-native-health-connect/blob/master/README.md>).
- **Lizenz:** MIT.

## Health-Connect-API-Grundlagen

Primärquelle: Android-Developer-Doku <https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started> (Get-started-Guide) und <https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data> (Read-data-Guide).

- **Verfügbarkeitsprüfung:** `HealthConnectClient.getSdkStatus(context)` liefert einen von drei Werten:
  - `SDK_UNAVAILABLE` — Health Connect ist nicht installiert.
  - `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` — installiert, aber Update nötig.
  - `SDK_AVAILABLE` — nutzbar, `HealthConnectClient.getOrCreate(context)` aufrufen.
- **`react-native-health-connect` bildet das 1:1 ab** (Turbo-Module-Spec, eingesehen im Quelltext `src/NativeHealthConnect.ts`, master-Branch):
  ```ts
  getSdkStatus(providerPackageName: string): Promise<number>;
  initialize(providerPackageName: string): Promise<boolean>;
  openHealthConnectSettings: () => void;
  openHealthConnectDataManagement: (providerPackageName?: string) => void;
  ```
  D. h. das Paket kapselt sowohl den Status-Check als auch das Öffnen der Health-Connect-Settings/Datenverwaltung — die Play-Store-Weiterleitung für "nicht installiert" muss die App selbst triggern (Intent auf `market://details?id=com.google.android.apps.healthdata`; Package-Name laut Play-Store-Listing <https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata>), das Paket öffnet nur die (bereits vorhandenen) Health-Connect-eigenen Screens.
- **Permissions & Manifest:** Für Steps-Lesezugriff wird die Permission `android.permission.health.READ_STEPS` benötigt (`<uses-permission android:name="android.permission.health.READ_STEPS"/>` im Manifest; im Expo-Workflow übernimmt das Config Plugin des Pakets diesen Eintrag automatisch). Anfrage zur Laufzeit über `HealthPermission.getReadPermission(StepsRecord::class)` bzw. in `react-native-health-connect`: `requestPermission([{ accessType: 'read', recordType: 'Steps' }])` (Quelle: <https://matinzd.github.io/react-native-health-connect/docs/permissions/>).
- **Lesen von Schritten:** Die offizielle Doku empfiehlt für kumulative Record-Typen wie `StepsRecord` **`aggregate()` statt `readRecords()`**, um Doppelzählung durch mehrere Datenquellen (z. B. Handy + Wearable) zu vermeiden:
  ```kotlin
  healthConnectClient.aggregate(
    AggregateRequest(
      metrics = setOf(StepsRecord.COUNT_TOTAL),
      timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
    )
  )[StepsRecord.COUNT_TOTAL] ?: 0L
  ```
  Für den in diesem Projekt geplanten Anwendungsfall (nur ein berechneter Tageswert in `daily_step_counts`, keine Rohdaten-Spiegelung) ist das direkt passend — `react-native-health-connect` exponiert dieselbe Aggregate-API (`aggregateRecord`).

## Mindest-Android-Version & Verfügbarkeit auf älteren Geräten

- **Health-Connect-SDK:** minSdkVersion **26** (Android 8.0 Oreo) — das ist die Untergrenze, ab der die Client-Library überhaupt kompiliert/aufgerufen werden kann (React-Native-Paket-README und Android-Doku stimmen überein).
- **Health-Connect-App/Provider:** Auf Geräten **vor Android 14** ist Health Connect eine eigenständige App, die aus dem Play Store nachinstalliert werden muss (Package `com.google.android.apps.healthdata`, Play-Store-Link oben). Praktisch nutzbar ist sie ab Android 9 (API 28) mit installierter Standalone-App.
- **Ab Android 14 (API 34):** Health Connect ist **Teil des Android-Frameworks** — keine separate Installation nötig, keine Play-Store-Weiterleitung erforderlich (Quelle: README des Pakets, Abschnitt "Requirements"; bestätigt durch Android-Doku "Starting from Android 14, Health Connect is part of the Android Framework").
- **Fazit für die App:** Auf Geräten < Android 14 muss die App damit rechnen, dass `getSdkStatus()` `SDK_UNAVAILABLE` zurückgibt, und braucht einen expliziten Play-Store-Verweis (eigener Intent, s.o.) als Fallback-UX; ab Android 14 ist `SDK_UNAVAILABLE` nur noch bei sehr seltenen/deaktivierten Geräten zu erwarten.

## Play-Console-Hinweis (Nebenbefund)

Für den Play-Store-Release muss der Health-Connect-Datenzugriff deklariert werden — das lief historisch über ein separates Google-Formular, das laut Paket-README **zum 2026-09-03 abgeschaltet wird**; Deklaration läuft ab dann ausschließlich über die Play Console, Freischaltung kann laut Google Fit AHP Support bis zu 7 + 5-7 Werktage dauern (wöchentliches Whitelist-Update). Relevant für die Release-Planung von #273, nicht für die technische Machbarkeit.

## Für den Dev-Client-Rebuild (AGENTS.md-Constraint)

`react-native-health-connect` ist eine neue native Dependency mit Config Plugin. Ihr Einbau erfordert zwingend einen Android-Dev-Client-Rebuild (analog zu `scripts/ios-dev.sh`, aber für Android/`expo prebuild` + `eas build --profile development --platform android` bzw. lokal `expo run:android`) — kein Hot-Reload-fähiges JS-only-Paket.

## Quellen

- <https://www.npmjs.com/package/react-native-health-connect> (npm-Registry-Metadaten via `registry.npmjs.org`, Version/Datum)
- <https://github.com/matinzd/react-native-health-connect> (Repo-Metadaten via GitHub-API: `pushed_at`, `open_issues_count`, `archived`)
- <https://github.com/matinzd/react-native-health-connect/blob/master/README.md> (Requirements, Expo-Installation, Features, Beispielcode)
- <https://github.com/matinzd/react-native-health-connect/blob/master/package.json> (peerDependencies, codegenConfig)
- <https://github.com/matinzd/react-native-health-connect/blob/master/src/NativeHealthConnect.ts> (TurboModule-Spec: `getSdkStatus`, `openHealthConnectSettings`, `openHealthConnectDataManagement`, `aggregateRecord`)
- <https://matinzd.github.io/react-native-health-connect/docs/permissions/> (Permission-Strings, Manifest-Eintrag, JS-API)
- <https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started> (`getSdkStatus`, SDK-Status-Konstanten, minSdkVersion)
- <https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data> (`ReadRecordsRequest`, `aggregate()`-Empfehlung für `StepsRecord`)
- <https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata> (Package-Name/Play-Store-Eintrag Health Connect)
