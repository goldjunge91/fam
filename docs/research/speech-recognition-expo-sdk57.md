# Research: Speech-Recognition-Optionen für Expo SDK 57

Ticket: #266. Kontext: Sprachsteuerung im Kochmodus (Folgeticket #267 für UI/UX-Design).

## Empfehlung

**`expo-speech-recognition` (Community-Paket von jamsch), primär mit On-Device-Erkennung (`requiresOnDeviceRecognition: true` bzw. Androids `createOnDeviceSpeechRecognizer`).**

Begründung:

- Es ist die einzige derzeit aktiv gepflegte Lösung für Speech-to-Text in einem Expo-Dev-Client-Projekt. Der bisherige Platzhirsch `@react-native-voice/voice` ist **archiviert** (read-only seit 31.01.2026) und verweist in seiner eigenen Doku explizit auf `expo-speech-recognition` als Nachfolger.
- Es unterstützt On-Device-Erkennung auf iOS 17+ und Android 13+, was zum Local-First-Prinzip des Projekts passt: keine Internetpflicht, keine Cloud-Kosten, keine Nutzdaten, die den Haushalt/Server verlassen.
- Es ist kein natives Standard-Expo-SDK-Paket (kein Symmetriepartner zu `expo-speech`), sondern Community — das ist aber im Moment die einzig praktikable Wahl.
- **Offener Punkt vor dem Einsatz:** Das Paket versioniert sich seit v56 parallel zur Expo-SDK-Nummer. Zum Zeitpunkt dieser Recherche (2026-08-29) existiert noch **kein `57.x`-Release** auf npm (aktuell `56.0.4`, veröffentlicht 2026-08-28) — SDK-57-Kompatibilität muss vor Produktiveinsatz per Testinstallation verifiziert werden, ist aber laut Wartungsrhythmus des Autors nur eine Frage der Zeit (SDK 56 → 57 Bump folgte historisch schnell auf SDK-Releases).

Jede Entscheidung für dieses Paket erfordert einen **Dev-Client-Rebuild** (Config-Plugin ändert `Info.plist`/`AndroidManifest.xml`) — kein Betrieb in Expo Go, kein stiller Einbau ohne Rebuild, siehe AGENTS.md.

---

## 1. Offizielle Expo-SDK-57-Option?

`docs.expo.dev/versions/v57.0.0/` listet im SDK-Index **kein** Speech-Recognition-Paket. Es existiert nur `expo-speech` — das ist **Text-to-Speech (TTS)**, keine Spracherkennung:

> "A library that provides access to text-to-speech functionality." — verfügbar auf Android, iOS, Web, auch in Expo Go.

Es gibt **keinen** offiziellen/experimentellen Speech-Recognition-Gegenpart zu `expo-speech` in SDK 57.

Quellen:
- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/versions/v57.0.0/sdk/speech/

## 2. Community-Alternativen

### `expo-speech-recognition` (jamsch)

- npm: `expo-speech-recognition`, aktueller Tag `latest` = `56.0.4`, veröffentlicht **2026-08-28** (also praktisch tagesaktuell zum Zeitpunkt dieser Recherche) — aktiv gepflegt.
- GitHub `jamsch/expo-speech-recognition`: 671 Stars, 51 Forks, 227 Commits, `pushed_at` 2026-08-28, **nicht archiviert**, 57 offene Issues (keine als kritischer Blocker identifiziert, überwiegend Konfigurations-/Troubleshooting-Themen laut README/Changelog).
- Versionierungsschema seit `56.0.0`: "From SDK 56, versioning for expo-speech-recognition has changed to be in line with Expo versioning" — d.h. Paketversion soll künftig 1:1 der Expo-SDK-Nummer folgen. Aktuell aber noch kein `57.x` auf npm gelistet (Stand 2026-08-29, geprüfte Versionsliste endet bei `56.0.4`).
- Peer-Dependencies sind offen deklariert (`expo: *`, `react: *`, `react-native: *`), kein `engines`-Constraint — keine harte Blockade gegen RN 0.86/React 19.2, aber auch keine explizite Garantie. New-Architecture-Kompatibilität wird im Changelog nicht explizit erwähnt; da Expo seit SDK 55 New Architecture verpflichtend macht, muss jede SDK-56/57-taugliche Version implizit damit funktionieren.
- **Config Plugin nötig**, verändert Android-Manifest für Package-Visibility-Filtering (`com.google.android.googlequicksearchbox`) und Permissions. **Kein Expo-Go-Support** — Doku verlangt explizit `npx expo run:android` / `npx expo run:ios` bzw. einen Dev-Client-Build nach Plugin-Konfiguration.

Quellen:
- https://www.npmjs.com/package/expo-speech-recognition (npm-Registry-Metadaten per `registry.npmjs.org` abgefragt)
- https://github.com/jamsch/expo-speech-recognition (README, CHANGELOG.md via raw.githubusercontent.com)

### `@react-native-voice/voice`

- **Archiviert seit 31.01.2026** ("read-only" Repo-Status). npm-Registry-Abfrage für dieses Paket ergab keine Antwort (Paket faktisch tot/nicht mehr sinnvoll auflösbar).
- README verweist explizit: "Please use this actively maintained alternative: `expo-speech-recognition`".
- Keine Aussage zu New-Architecture/Fabric-Support vorhanden — angesichts der Archivierung irrelevant für Neueinsatz.
- **Fazit: nicht verwenden**, reines Auslaufmodell.

Quelle: https://github.com/react-native-voice/voice

### Sonstige Optionen (kurz geprüft, verworfen)

- Cloud-APIs (Google Cloud Speech-to-Text, OpenAI Whisper API, etc.) wurden als *Backend hinter einem eigenen Recording-Flow* geprüft, nicht als RN-Bibliothek — siehe Abschnitt 3. Direkter WebFetch auf `cloud.google.com/speech-to-text/pricing` und `openai.com/api/pricing` schlug technisch fehl (Verbindungsabbruch); die grobe Preisordnung (niedriger Cent-Betrag pro Minute, kostenloses Kontingent begrenzt) ist über Sekundärquellen plausibilisiert, aber **nicht primärquellen-verifiziert** — vor einer Kostenkalkulation muss `cloud.google.com/speech-to-text/pricing` nochmals direkt eingesehen werden.

## 3. On-Device vs. Cloud, Kosten, Sprachabdeckung (Deutsch)

**iOS — Apple Speech Framework (`SFSpeechRecognizer`):**
- `SFSpeechRecognizer.supportsOnDeviceRecognition` zeigt Geräte-/Sprachverfügbarkeit an; `SFSpeechRecognitionRequest.requiresOnDeviceRecognition` erzwingt lokale Verarbeitung ohne Serverkontakt.
- On-Device-Diktat für `de-DE` erfordert, dass die deutsche Tastatur installiert und Diktat in den Systemeinstellungen aktiviert ist, inkl. heruntergeladenem Sprachmodell — das ist eine Systemvoraussetzung, keine App-Konfiguration.
- Nicht jede Sprache/jedes Feature ist on-device verfügbar; ohne `requiresOnDeviceRecognition` kann iOS bei Bedarf auf Apples Server zurückgreifen (Kosten für den Nutzer: keine, für die App: keine — Apples eigener Dienst, aber Internetabhängigkeit und Datenabfluss an Apple).

Quellen:
- https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition
- https://developer.apple.com/forums/thread/96377 (SFSpeechRecognizer offline support)

**Android — `SpeechRecognizer`:**
- `EXTRA_PREFER_OFFLINE` ist ein optionales Flag für ältere Intent-basierte Erkennung — es ist nur eine *Präferenz*, kein Zwang; kann auf Cloud zurückfallen.
- Seit **Android 13 (API 33)** existiert `createOnDeviceSpeechRecognizer()` — erzwingt echte On-Device-Erkennung und **schlägt fehl**, wenn keine kompatible lokale Engine verfügbar ist (robuster als `EXTRA_PREFER_OFFLINE`).
- Auf Android 12 und darunter: kein garantiertes On-Device-Verhalten, Erkennung läuft typischerweise über die Standard-Engine des Geräts (meist Google, ggf. OEM-Ersatz) — de facto häufig Cloud-abhängig.
- `expo-speech-recognition` verlangt auf Android 13+ zusätzlich den manuellen Download des Sprachmodells (`androidTriggerOfflineModelDownload()`), ~100–200 MB pro Sprache.

Quellen:
- https://developer.android.com/reference/android/speech/SpeechRecognizer (Live-Doku nur als Index abrufbar; Webarchiv-Spiegelung als ergänzende historische Referenz konsultiert)
- README `jamsch/expo-speech-recognition`

**Kosten- und Local-First-Bewertung:**
- On-Device-Erkennung (iOS 17+, Android 13+ via `createOnDeviceSpeechRecognizer`) ist **kostenlos, offline-fähig und datenschutzkonform** — passt zum Local-First-Prinzip des Projekts (siehe AGENTS.md Pillar 3).
- Cloud-basierte Erkennung (Fallback auf älteren Android-Versionen, oder ein separater Cloud-STT-Dienst) widerspricht dem Local-First-Prinzip: Internetpflicht im Kochmodus (oft in der Küche mit schlechtem WLAN) und laufende Kosten pro Minute Sprachaufnahme.
- **Empfehlung:** Kochmodus-Sprachsteuerung sollte `requiresOnDeviceRecognition: true` (iOS) bzw. `createOnDeviceSpeechRecognizer` (Android 13+) erzwingen und auf älteren Android-Versionen ohne On-Device-Unterstützung die Funktion schlicht deaktivieren/ausblenden, statt auf Cloud auszuweichen.

## 4. iOS/Android-Paritätslücken

| Feature | Android ≤12 | Android 13+ | iOS 17+ |
|---|---|---|---|
| Basis-Erkennung | Ja | Ja | Ja |
| Continuous Mode | Nein | Ja | Ja |
| On-Device-Erkennung | Nein | Ja (Modell-Download nötig) | Ja (systemseitig, Sprache muss installiert sein) |
| Audioaufnahme-Persistenz | Nein | Ja | Ja |
| Sprach-/Locale-Erkennung | Nein | Ja* (Google-Assistant-Dienst nötig) | Nein |

\* erfordert `com.google.android.as` (Google-Assistant-Systemdienst).

Fazit: Android hat vor API 33 eine spürbare Fähigkeitslücke gegenüber iOS 17+; ältere Android-Geräte sind der schwächste gemeinsame Nenner.

Quelle: README `jamsch/expo-speech-recognition`.

## 5. App-Store-Review: Mikrofonzugriff

**Erforderliche Info.plist-Keys (iOS):**
- `NSMicrophoneUsageDescription` — Pflicht bei jeglichem Mikrofonzugriff. Fehlt der Key, lehnt App Store Connect den Build mit Fehlercode **ITMS-90683** ("Missing purpose string") bereits beim Upload ab, nicht erst bei manueller Review.
- `NSSpeechRecognitionUsageDescription` — zusätzlich Pflicht, sobald `SFSpeechRecognizer`/das Speech-Framework verwendet wird (auch wenn nur on-device erkannt wird — die Anfrage nach der Berechtigung selbst braucht den Key).
- Beide Strings müssen laut Apples App Review Guidelines (Abschnitt 5.1.1) **klar und vollständig** erklären, wofür die Daten verwendet werden — generische/leere Platzhalter führen zur Ablehnung.

**Android:**
- `RECORD_AUDIO`-Permission im Manifest (wird vom `expo-speech-recognition`-Config-Plugin automatisch ergänzt) — Laufzeit-Permission-Dialog erforderlich, keine zusätzliche Play-Store-Deklaration über die Standard-Permission-Prüfung hinaus.

**Typische Ablehnungsgründe (Apple, Abschnitt 2.5.14 "Recording" + 5.1.1 "Data Collection and Storage"):**
- Fehlender/generischer Purpose-String.
- Mikrofonzugriff ohne klare visuelle/akustische Aufnahme-Anzeige während der Erkennung.
- Anfrage nach Mikrofon-/Spracherkennungs-Berechtigung, ohne dass die Kernfunktion (Kochmodus-Sprachsteuerung) das erkennbar rechtfertigt — im Fall dieses Features unproblematisch, da die Funktion selbsterklärend ist, aber der Purpose-String muss genau das benennen ("Sprachsteuerung während des Kochens, um Zutaten/Schritte freihändig zu bestätigen" o. ä.), nicht nur "Mikrofonzugriff".
- Erzwingen der Systemberechtigung als Voraussetzung für unrelated Kernfunktionen ist unzulässig — im Kochmodus ist das kein Risiko, solange Sprachsteuerung ein optionales Zusatzfeature bleibt und die App ohne Mikrofonberechtigung weiter nutzbar ist.

Quellen:
- https://developer.apple.com/app-store/review/guidelines/ (Abschnitte 2.5.14, 5.1.1)
- https://developer.apple.com/forums/thread/63581 (Beispiel eines vergleichbaren Usage-Description-Ablehnungsmusters für einen anderen Permission-Typ, zur Bestätigung des allgemeinen Mechanismus)

## 6. Dev-Build-Implikationen

- `expo-speech-recognition` **erfordert zwingend** einen Config Plugin-Eintrag in `app.json`/`app.config.ts` sowie einen nativen Rebuild (`npx expo run:ios` / `npx expo run:android`, bzw. den projektspezifischen `bash scripts/ios-dev.sh`-Flow bzw. EAS-Dev-Client-Build). **Kein Betrieb in Expo Go.**
- Das deckt sich mit der bestehenden Projektkonvention (native Module → Dev-Client-Rebuild nötig, sonst `Cannot find native module` beim Metro-Reload, siehe CLAUDE.md/AGENTS.md).
- Konkret verändert der Plugin: iOS `Info.plist` (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`), Android `AndroidManifest.xml` (Permission `RECORD_AUDIO`, Package-Visibility-Filter für `com.google.android.googlequicksearchbox`).
- Jede Einführung dieses Pakets muss dem Nutzer vorab als "neue native Dependency, Dev-Client-Rebuild nötig" gemeldet werden (AGENTS.md: "Keine stillen Native-Module-Installationen").

---

## Entscheidungstabelle

| Option | Wartung | Offline-fähig | Deutsch | iOS/Android-Parität | Dev-Build nötig |
|---|---|---|---|---|---|
| Offizielles Expo-SDK-Paket | — (existiert nicht) | — | — | — | — |
| `expo-speech-recognition` (jamsch) | Aktiv (Release 2026-08-28), noch kein expliziter SDK-57-Tag | Ja, iOS 17+ / Android 13+ | Ja (`de-DE` via `getSupportedLocales()`, System-Sprachpaket nötig) | Android <13 spürbar schwächer als iOS 17+ | Ja, Config Plugin + Rebuild |
| `@react-native-voice/voice` | **Archiviert, tot** | Ja (laut alter Doku) | Nicht explizit dokumentiert | Nicht mehr relevant | Ja (obsolet) |
| Cloud-STT (Google/OpenAI o. ä.) | Anbieterabhängig | Nein — widerspricht Local-First | Ja (breite Sprachabdeckung) | Plattformunabhängig (Server-seitig) | Kein natives Modul nötig, aber API-Key/Backend-Anbindung |

---

## Offene Punkte für #267 (Design-Ticket)

1. Vor Produktiveinsatz: Testinstallation von `expo-speech-recognition` gegen Expo SDK 57 / RN 0.86 verifizieren (npm zeigt zum Recherchezeitpunkt nur bis `56.0.4`).
2. Entscheidung treffen: Feature auf Android <13 ausblenden oder mit reduzierter (ggf. cloud-basierter) Erkennung anbieten — Empfehlung: ausblenden, um Local-First-Prinzip nicht zu brechen.
3. Deutsche Purpose-Strings für `NSMicrophoneUsageDescription`/`NSSpeechRecognitionUsageDescription` konkret formulieren (Kochmodus-Kontext).
