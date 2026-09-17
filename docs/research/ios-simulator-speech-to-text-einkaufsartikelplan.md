# Recherche: Speech-to-Text im iOS-Simulator für den Einkaufsartikelplan

Stand: 17. September 2026  
Scope: Expo SDK 57 / React Native 0.86, `expo-speech-recognition`, iOS-Simulator

## Kurzentscheidung

Der aktuelle Fehler ist kein Metro- oder Berechtigungsproblem im Einkaufsartikelplan.
Der lokale Log zeigt, dass der Apple-Sprach-Recognizer auf dem iOS-26.5-Simulator
nach erteilter Berechtigung mit `kLSRErrorDomain Code=300` startet und abbricht.
Apples offizielle API-Dokumentation definiert Code 300 als `Failed to initialize
recognizer`, dokumentiert aber keine simulator- oder runtime-spezifische Ursache:
[Speech task error codes](https://developer.apple.com/documentation/speech/sfspeechrecognitiontask/error?changes=_10_4).

Die belastbare simulator-only-Entscheidung lautet:

1. Der bestehende Apple-Recognizer (`expo-speech-recognition` /
   `SFSpeechRecognizer`) kann trotz `isAvailable` und erteilter Berechtigungen
   mit Code 300 scheitern. Apples Dokumentation sagt selbst nur, dass
   `isAvailable` die aktuelle Verfügbarkeit beschreibt und ein gültiger
   Recognizer trotzdem temporär nicht verfügbar sein kann:
   [Apple `isAvailable`](https://developer.apple.com/documentation/speech/sfspeechrecognizer/isavailable?changes=l_5)
   und [Apple `init(locale:)`](https://developer.apple.com/documentation/speech/sfspeechrecognizer/init%28locale%3A%29?changes=_5%2C_5).
2. Eine konkrete iOS-Runtime als funktionierenden Workaround ist durch die
   offiziellen Quellen nicht belegt und wird deshalb nicht als Lösung empfohlen.
3. Die dauerhafte Lösung für Live-Sprache im Simulator ist ein lokaler
   Whisper-Pfad über `react-native-executorch` plus `react-native-audio-api`.
   Apples Simulator kann den Mac-Eingang über `Device > Sound > Sound Input >
   System` erhalten; Whisper umgeht dabei den defekten Apple-Speech-Recognizer.
4. Der vorhandene ExecuTorch-Dev-Screen beweist, dass die nativen Bausteine im
   Repo bereits eingebunden sind. Für das Feature muss derselbe Recorder-/Whisper-
   Pfad in den Einkaufsartikelplan-Adapter integriert werden. `Device.isDevice`
   darf diesen Simulatorpfad daher nicht pauschal deaktivieren.

Damit bleibt der Simulator die einzige Abnahmeumgebung. Eine echte Hardware ist
für diese Lösung weder Testvoraussetzung noch Bestandteil des vorgeschlagenen
Workflows.

## Lokaler Befund

### Umgebung

Die lokale Maschine hat laut read-only Prüfung:

- Xcode 27.0 (`27A266`)
- nur die iOS-26.5-Runtime (`23F77`)
- einen gebooteten iPhone-17-Simulator
- Expo `57.0.19`, React Native `0.86.3`
- `expo-speech-recognition` tatsächlich installiert als `57.1.0`
- `react-native-audio-api` tatsächlich installiert als `0.13.3`
- `react-native-executorch` tatsächlich installiert als `0.10.2`

Die Native-Abhängigkeiten sind in der lokalen iOS-Pod-Auflösung vorhanden:
`ExpoSpeechRecognition`, `RNAudioAPI` und `react-native-executorch` stehen in
[`ios/Podfile.lock`](/Users/marco/Github.tmp/family_app/fam/ios/Podfile.lock:349).
Die beiden Permission-Usage-Keys sind ebenfalls in der generierten
[`ios/fam/Info.plist`](/Users/marco/Github.tmp/family_app/fam/ios/fam/Info.plist:86)
vorhanden.

### Ablauf im Einkaufsartikelplan

Der App-Adapter prüft zunächst Verfügbarkeit und fragt danach die Berechtigung an:
[`speech-recognition-adapter.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.ts:160).
Der lokale Start verwendet `de-DE`, Zwischenresultate, `continuous: false`,
`iosTaskHint: 'dictation'` und aktuell
`requiresOnDeviceRecognition = false`:
[`speech-recognition-adapter.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.ts:101)
und [`speech-recognition-adapter.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.ts:257).

Das bedeutet zwei Dinge:

- Der aktuelle Pfad ist trotz seines Adapter-Namens kein erzwungener
  On-Device-Pfad. Bei `false` fordert er auch die Speech-Recognition-
  Autorisierung an.
- Das ist eine Abweichung von der ursprünglichen Idee, die native
  On-Device-Erkennung als MVP-Grenze zu verwenden. Diese Abweichung ist für den
  Simulatorfehler nicht die Ursache, aber sie muss vor einer Produktentscheidung
  über Offline- und Datenschutzverhalten bewusst korrigiert oder bestätigt
  werden.

Die App-Konfiguration enthält den Config-Plugin-Eintrag für
`expo-speech-recognition` mit beiden iOS-Usage-Descriptions:
[`app.json`](/Users/marco/Github.tmp/family_app/fam/app.json:131). Das entspricht
dem Expo-Modell, nach dem native Berechtigungen in Development- und Standalone-
Builds zur Build-Zeit konfiguriert und zur Laufzeit angefragt werden
([Expo: Permissions](https://docs.expo.dev/guides/permissions/)).

### Logs und Ereigniskette

Der vorhandene App-Log zeigt auf dem iOS-26.5-Simulator folgende Reihenfolge:

1. Der Speech-Overlay- und Session-Start wird ausgelöst, mit `locale: de-DE`.
2. Die Permission-Anfrage liefert `granted: true`, `status: granted` und
   `canAskAgain: true`.
3. Danach lädt Apples Speech-Framework den `de-DE`-Assistant-Asset und startet
   `AVAudioEngine` auf `iOSSimulatorAudioDevice`.
4. Der Recognizer stoppt sofort mit `Failed to initialize recognizer`.
5. Der Adapter erhält `audio-capture` und beendet die Session mit demselben
   Fehlercode.

Nachweise:

- Permission und Speech-Asset-Auflösung: [`app.log`](/Users/marco/.agent-device/sessions/cwd_9878f1c9d26b12c3_default/app.log:7013)
- Simulator-Audio-Engine, 48-kHz-Eingang und `iOSSimulatorAudioDevice`:
  [`app.log`](/Users/marco/.agent-device/sessions/cwd_9878f1c9d26b12c3_default/app.log:7059)
- `Failed to initialize recognizer`, `audio-capture` und Session-Ergebnis:
  [`app.log`](/Users/marco/.agent-device/sessions/cwd_9878f1c9d26b12c3_default/app.log:7084)

Im referenzierten Task [„Überarbeite Einkaufsartikelplan“](thread://01a0ab67-e683-78e3-9cbd-0c82a1b0369a?hostId=local)
wurde während desselben Repros außerdem festgehalten, dass Metro auf
`127.0.0.1:8081/status` mit `200 OK` antwortete und das iOS-Bundle erfolgreich
erstellt wurde. Der aktuell erneute `curl`-Check ist nach dem vom Task
beendeten Metro-Prozess erwartbar nicht mehr erreichbar; daraus folgt kein neuer
Speech-Befund.

## Warum `audio-capture` hier nicht einfach „Mikrofonberechtigung fehlt“ bedeutet

Die maßgebliche Paketimplementierung trennt die Fälle:

- `isRecognitionAvailable()` fragt `SFSpeechRecognizer.isAvailable` ab.
- Die Berechtigung wird vor dem Start geprüft.
- `requiresOnDeviceRecognition` steuert, ob die Speech-Authorization zusätzlich
  zur Mikrofonberechtigung nötig ist.
- Fehler der nativen Speech-Task werden anschließend auf die Web-Speech-artigen
  Fehlercodes abgebildet.

Im verwendeten Quelltext von `expo-speech-recognition` ist `Code=300` als
`kLSRErrorDomain: Failed to initialize recognizer` dokumentiert, während ein
unbekannter oder audio-/enginebezogener Fehler als `audio-capture` weitergegeben
wird: [ExpoSpeechRecognitionModule.swift](https://github.com/jamsch/expo-speech-recognition/blob/main/ios/ExpoSpeechRecognitionModule.swift).
Die README beschreibt `audio-capture` als Audioaufnahmefehler und dokumentiert
`isRecognitionAvailable()` ausdrücklich nur als Verfügbarkeitsprüfung, nicht als
Garantie, dass ein späterer Start erfolgreich ist:
[expo-speech-recognition README, Fehlerbehandlung und API](https://github.com/jamsch/expo-speech-recognition#handling-errors).

Der lokale Log passt daher zu dieser Kette: Das `true` bei der Berechtigung
schließt einen TCC-/Info.plist-Fehler weitgehend aus, und `audio-capture` ist hier
die Paket-Abbildung eines späteren nativen Initialisierungsfehlers.

## Auflösung des Quellenkonflikts: Apple versus Expo

### Apples aktuelle Dokumentation: Simulator-Audio kann konfiguriert werden

Apples aktuelle Xcode-Dokumentation beschreibt ausdrücklich:

- `Device > Sound > Sound Input`
- Auswahl eines konkreten Eingabegeräts
- `System`, um denselben Audioeingang wie der Mac zu verwenden

Quelle: [Configuring the environment of a simulated device](https://developer.apple.com/documentation/xcode/configuring-the-environment-of-a-simulated-device).

Zusätzlich dokumentieren Apples Xcode-Release-Notes, dass Simulator-Audioinput
von macOS-Mikrofonberechtigungen abhängen kann und dass die Berechtigung des
Simulator-Hosts nicht dasselbe ist wie die Mikrofonberechtigung innerhalb des
simulierten iOS-Systems: [Xcode 10 Release Notes, Simulator microphone access](https://developer.apple.com/documentation/xcode-release-notes/xcode-10-release-notes/).

Daraus folgt: Es ist falsch, pauschal zu behaupten, jeder aktuelle Simulator
habe grundsätzlich kein Mikrofon. Ein aktueller Simulator kann einen Host-
Audioeingang angeboten bekommen.

### Expo-Dokumentation: konservative Capability-Grenze

Die Expo-Seite [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/)
führt weiterhin `Audio Input` unter den im Simulator nicht verfügbaren
Hardware-Funktionen. Die Aussage ist als breite Expo-Kompatibilitäts- und
Testwarnung nützlich, steht aber in Spannung zu Apples aktueller
Sound-Input-Konfiguration.

Die richtige Einordnung ist nicht „eine Quelle ist falsch, daher gibt es keine
Einschränkung“, sondern:

1. Apple beschreibt, was die aktuelle Simulator-/Xcode-Umgebung konfigurieren
   kann: Host-Audioinput ist möglich.
2. Expo garantiert für seine APIs keinen verlässlichen Audio-Input-Testpfad im
   Simulator und empfiehlt deshalb weiterhin, solche Hardwarepfade nicht als
   Simulator-Capability anzunehmen.
3. Selbst wenn der Host-Eingang konfiguriert ist, löst er nicht den konkreten
   Speech-Recognizer-Fehler beim Start der Recognition-Task.

Für dieses Repo bedeutet das: Sound Input muss vor dem lokalen Whisper-Test
konfiguriert und mit einem Roh-Recorder geprüft werden. Der Apple-Recognizer
bleibt davon getrennt, weil Code 300 erst beim Start der Recognition-Task
auftritt.

## Belastbare Apple-Aussagen und lokale Evidenz

Apples offizielle Dokumentation trägt diese Aussagen:

- Code `300` bedeutet `Failed to initialize recognizer`.
- `isAvailable` erlaubt das Erzeugen neuer Tasks, ist aber keine Garantie, dass
  der Start erfolgreich bleibt.
- Ein Recognizer kann trotz gültiger Initialisierung vorübergehend nicht
  verfügbar sein.

Der lokale App-Log ergänzt diese offiziellen Aussagen:

- Speech- und Mikrofonberechtigung sind `granted`.
- Der Simulator-Audioeingang wird initialisiert.
- Danach folgt Code 300 und im Expo-Adapter `audio-capture`.

Damit ist der Fehler lokal reproduziert und semantisch eingegrenzt. Eine
simulator- oder versionsspezifische Ursache wird in diesem Bericht jedoch nicht
als bewiesen ausgegeben.

Apples Speech-API selbst macht ebenfalls klar, dass `supportsOnDeviceRecognition`
und `requiresOnDeviceRecognition` die Anerkennungsroute konfigurieren, aber nicht
die Simulator-Implementierung reparieren: [SFSpeechRecognitionRequest](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest)
und [supportsOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition).

## Bewertung der Lösungsoptionen

### 1. Permission-, Locale- oder Metro-Fix

Nicht als Hauptlösung empfohlen.

Die lokalen Nachweise sprechen dagegen:

- Metro bundelt und liefert JavaScript.
- `de-DE` erreicht den nativen Start.
- `NSMicrophoneUsageDescription` und `NSSpeechRecognitionUsageDescription`
  sind vorhanden.
- der Permission-Status ist `granted`.
- der Fehler kommt erst nach dem Start der nativen Audio-/Speech-Engine.

Die iOS-Speech-API verlangt weiterhin korrekte Permission-Konfiguration:
[Apple: requestAuthorization](https://developer.apple.com/documentation/speech/sfspeechrecognizer/requestauthorization%28_%3A%29)
und [Apple: requestRecordPermission](https://developer.apple.com/documentation/avfaudio/avaudiosession/requestrecordpermission%28_%3A%29).
Diese Voraussetzungen sind im Repo erfüllt; sie sind deshalb Verifikation,
nicht der aktuelle Reparaturhebel.

### 2. Simulator-Sound Input aktivieren

Sinnvoll als kurzer Diagnoseversuch:

1. Simulator fokussieren.
2. `Device > Sound > Sound Input > System` oder ein konkretes Host-
   Eingabegerät wählen.
3. Falls macOS eine Mikrofonfreigabe für Simulator/Xcode verlangt, diese
   erteilen und den Simulator neu starten.
4. Mit einem simplen Roh-Audio-/Recorder-Test prüfen, ob tatsächlich PCM-
   Chunks ankommen.

Das kann einen fehlenden Host-Eingang beheben. Es erklärt aber nicht den bereits
beobachteten Apple-Fehler: Im lokalen Log wird ein
`iOSSimulatorAudioDevice` mit Input-Format initialisiert, bevor der Recognizer
mit Code 300 abbricht. Daher ist diese Maßnahme keine belastbare Produktlösung.

### 3. React Native ExecuTorch live streaming im Simulator

Die offizielle ExecuTorch-STT-Dokumentation beschreibt Live-Streaming als
Kombination aus Whisper, `stream()`/`streamInsert()` und einem Mikrofon-Recorder
wie `react-native-audio-api`: [React Native ExecuTorch: Speech-to-Text](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text).
Die Audio-API-Dokumentation verlangt ebenfalls Mikrofonberechtigung,
Audio-Session-Aktivierung und einen Recorderstart: [React Native Audio API: AudioRecorder](https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder/).

Der vorhandene Dev-Pfad bestätigt das lokal:

- `AudioManager.requestRecordingPermissions()` wird aufgerufen.
- `AudioRecorder` wird erstellt.
- `onAudioReady` liefert die Mikrofon-Chunks.
- erst danach werden die Chunks mit `streamInsert()` an Whisper gegeben.

Nachweise: [`use-executorch-audio-recorder.ts`](/Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/use-executorch-audio-recorder.ts:47)
und [`executorch-speech-to-text-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/executorch-speech-to-text-screen.tsx:34).

Das ist der passende dauerhafte Simulatorpfad, sofern der Host-Eingang korrekt
konfiguriert ist: Er verwendet Apples Audioaufnahme nur als PCM-Quelle und nicht
Apples fehleranfälligen `SFSpeechRecognizer`. Das ist eine begründete
Architektur-Inferenz aus Apples dokumentiertem Simulator-Sound-Input und
ExecuTorchs dokumentiertem Mikrofon-Streaming; die ExecuTorch-Dokumentation
behauptet nicht ausdrücklich, jede Simulator-Runtime zu unterstützen. Die technische Grenze bleibt der
Simulator-Audioeingang selbst. Deshalb muss der Adapter zusätzlich einen
Recorder-Smoke-Test oder eine klare Fehlermeldung für fehlende PCM-Chunks haben.

Konkrete Integration in den Einkaufsartikelplan:

```text
Device > Sound > Sound Input > System
  -> AudioManager + AudioRecorder (16 kHz, mono, Float32)
  -> Whisper stream({ language: 'de' })
  -> streamInsert(samples)
  -> vorhandener Artikel-Parser / Preview / Bestätigung
```

### 4. ExecuTorch `transcribe()` mit Audio-Fixture

Das ist der sinnvolle deterministische Simulatorpfad. ExecuTorch dokumentiert
die Transkription eines vorhandenen PCM-Puffers ohne Live-Mikrofon:

- Audio als `Float32Array` mit 16 kHz zuführen
- bei einem multilingualen Whisper-Modell den Sprachcode `de` setzen
- `transcribe()` für den vollständigen Text verwenden
- das Modell, den Tokenizer und den VAD einmal laden und danach wiederverwenden

Quelle: [ExecuTorch STT, pre-recorded audio transcription and models](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text).
Die lokale Dev-Ansicht nutzt bereits das multilinguale Whisper-Tiny-Modell und
`language: 'de'`:
[`executorch-speech-to-text-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/executorch-speech-to-text-screen.tsx:11)
und [`executorch-speech-to-text-screen.tsx`](/Users/marco/Github.tmp/family_app/fam/src/features/settings/dev/executorch-speech-to-text-screen.tsx:43).

Für den Einkaufsartikelplan ist die empfohlene Fixture-Pipeline daher:

```text
WAV/PCM-Fixture
  -> Decoder/Resampler auf 16 kHz mono Float32Array
  -> Whisper transcribe({ language: 'de' })
  -> derselbe lokale Artikel-Parser wie bei Texteingabe
  -> Parser-/Routing-/Preview-Assertions
```

Das prüft die für den Plan wichtige Transkriptions- und Artikellogik, ohne einen
unzuverlässigen Simulator-Liveeingang oder Apples Speech-Asset-Service als
Testvoraussetzung zu machen. Es bleibt ein nativer Dev-Build erforderlich; Expo
Go reicht für `react-native-executorch` nicht. Der ExecuTorch-Issue-Tracker
dokumentiert genau diese Link-/Pod-/Rebuild-Voraussetzung für Expo-Dev-Clients:
[Issue #137](https://github.com/software-mansion/react-native-executorch/issues/137).

## Lösungsentscheid für dieses Repo: Simulator-first

Der Einkaufsartikelplan soll im Simulator nicht mehr den Apple-Recognizer als
Live-Engine verwenden. Der Adapter braucht eine simulatorfähige lokale
Speech-Implementierung:

- `react-native-audio-api` liefert 16-kHz-mono-PCM aus dem konfigurierten
  Simulator-Eingang.
- `react-native-executorch` verarbeitet die Chunks mit Whisper Tiny und dem
  Sprachcode `de`.
- Das Ergebnis läuft durch denselben vorhandenen Artikel-Parser, Preview- und
  Bestätigungsworkflow wie jede andere Texteingabe.
- Der Apple-Adapter bleibt als separater, optionaler Provider erhalten, darf
  aber nicht mehr die Simulator-Abnahme blockieren.
- Wenn kein PCM-Eingang ankommt, wird ein konkreter Audiofehler angezeigt; als
  deterministischer Fallback bleibt `transcribe()` mit einer Fixture.

Die nachhaltige Feature-Lösung ist der lokale Whisper-Provider, weil er nicht
von der Initialisierung des Apple-Speech-Recognizers abhängt.

## Paketvergleich: React Native und Expo

Es gibt kein gefundenes Paket, das eine offizielle Garantie für Live-Speech-to-
Text im iOS-Simulator ausspricht. Die Pakete fallen in drei technische Gruppen:

| Paket | Engine | Expo/RN-Fit | Bewertung für dieses Repo |
| --- | --- | --- | --- |
| [`react-native-executorch`](https://github.com/software-mansion/react-native-executorch) | Lokales Whisper plus VAD | Expo SDK 55+, RN 0.83+, New Architecture, Development Build | Beste Passung: bereits installiert, offline, deutschfähiges Whisper, Live-PCM über `streamInsert()` |
| [`whisper.rn`](https://github.com/mybigday/whisper.rn) | `whisper.cpp`, optional Parakeet/VAD | Expo über Prebuild; zusätzlicher Realtime-Audio-Adapter | Gute lokale Alternative, aber deutlich mehr Modell-, Audio- und Speicherintegration |
| [`expo-ai-kit`](https://github.com/saidkaban/expo-ai-kit) | Apple SpeechAnalyzer auf iOS 26, ML Kit auf Android | Expo SDK 54+, Development Build | Interessant für iOS 26, aber jung und ohne nachgewiesene Simulator-Garantie |
| [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition) | Apple `SFSpeechRecognizer`, Android `SpeechRecognizer` | Expo-Config-Plugin, Development Build | Beste native API-Abstraktion, behebt aber den aktuellen Apple-Recognizer-Pfad nicht |
| [`react-native-nitro-speech`](https://github.com/NotGeorgeMessier/nitro-speech) | `SpeechAnalyzer` iOS 26+, Fallback auf `SFSpeechRecognizer` | Expo Prebuild, New Architecture, RN 0.76+ | Technisch interessant, aber noch wenig etabliert und ohne Simulator-Nachweis |
| [`expo-speech-transcriber`](https://github.com/DaveyEke/expo-speech-transcriber) | `SFSpeechRecognizer`/`SpeechAnalyzer`, Android SpeechRecognizer | Expo SDK 52+, Development Build | Nicht geeignet: laut eigener Dokumentation aktuell Englisch-only; außerdem gleicher Apple-Stack |
| [`react-native-deepgram`](https://github.com/itsRares/react-native-deepgram) | Deepgram Cloud über WebSocket/REST | Expo-Plugin und Development Build | Gute Live-Alternative, aber Netzwerk, API-Key und externe Sprachdaten widersprechen Local-First |
| [`@picovoice/leopard-react-native`](https://github.com/Picovoice/leopard) | Lokale Picovoice-Engine | React Native; Expo-Fit nicht belastbar dokumentiert | Deutsch und offline möglich, aber AccessKey-/Lizenzprüfung und zusätzliche Produktabhängigkeit |

### Pakete, die wir nicht als Lösung weiterverfolgen sollten

- [`@react-native-voice/voice`](https://github.com/react-native-voice/voice) ist archiviert und wird vom Maintainer durch `expo-speech-recognition` ersetzt.
- [`react-native-expo-speech-to-text`](https://github.com/AyoParadis/react-native-expo-speech-to-text) ist ein sehr junger Wrapper derselben nativen iOS-/Android-Erkennung. Er bietet keinen belegten Simulatorvorteil.
- [`react-native-voicekit`](https://github.com/kuatsu/react-native-voicekit) bezeichnet sich selbst als instabil und aktiv in Entwicklung; ein Simulator- oder Deutsch-Nachweis fehlt.
- [`expo-speech`](https://docs.expo.dev/versions/latest/sdk/speech/) ist Text-to-Speech, nicht Speech-to-Text.

### Einordnung für den Simulator

`expo-speech-recognition`, `expo-speech-transcriber`, `react-native-nitro-speech`,
`react-native-voicekit` und `react-native-expo-speech-to-text` sind native
Wrapper. Ein Wechsel zwischen ihnen entfernt die Abhängigkeit von Apples
Speech-Framework nicht automatisch. `expo-ai-kit` verwendet auf iOS ebenfalls
Apple SpeechAnalyzer und ist deshalb ein möglicher neuer Pfad, aber kein durch
Quellen belegter Simulator-Fix.

`react-native-executorch` und `whisper.rn` sind die einzigen untersuchten
Kandidaten, die die Erkennung selbst über Whisper/whisper.cpp ausführen und nur
PCM vom Mikrofon benötigen. Das ist eine Architektur-Inferenz, keine vom Paket
garantierte Simulator-Kompatibilität. Der Simulator-Eingang muss deshalb separat
mit `AudioRecorder` verifiziert werden.

### Entscheidung

1. Bestehenden `react-native-executorch`-Pfad weiterverwenden und in den
   Einkaufsartikelplan integrieren.
2. `whisper.rn` nur als technische Ausweichoption prüfen, falls ExecuTorchs
   bestehende Audio-/Modellintegration nicht genügt.
3. `expo-ai-kit` als gezielten iOS-26-Versuch zurückstellen, nicht als sichere
   Lösung einplanen.
4. Keine weitere native Apple-Wrapper-Bibliothek als vermeintlichen Fix für den
   Simulatorfehler einführen.

## Voraussetzungen für eine spätere Implementierung

1. Für Änderungen an `expo-speech-recognition`, `react-native-audio-api`,
   `react-native-executorch` oder `app.json`: nativen Development-Build neu
   erzeugen; Metro allein aktualisiert keine native Bibliothek. Expo beschreibt
   diesen Rebuild-Grenzfall in [Use a development build](https://docs.expo.dev/develop/development-builds/use-development-builds/).
2. Für den Apple-Simulator-Diagnosepfad: `NSMicrophoneUsageDescription`,
   `NSSpeechRecognitionUsageDescription`, Siri/Dictation, Mikrofonfreigabe und
   Sprache `de-DE` prüfen; `isRecognitionAvailable()` nicht als Startgarantie
   behandeln.
3. Für ExecuTorch: nativer Dev-Build mit gelinktem Paket, Modell-/Tokenizer-/VAD-
   Download oder Cache, 16-kHz-mono-PCM und Whisper-Sprachcode `de`.
4. Für Live-Simulatoraudio: `Device > Sound > Sound Input > System` setzen,
   macOS-Mikrofonfreigabe für Simulator/Xcode prüfen und einen Roh-Audio-Test
   vor dem Whisper-Start ausführen.
5. Keine Hardware-Abnahme als Voraussetzung einführen; der definierte
   Abnahmepfad bleibt der iOS-Simulator.

## Verifikationsplan

### A. Simulator-Diagnose, optional

1. Aktuelle Runtime und Gerät dokumentieren: Xcode 27.0, iOS 26.5 (`23F77`).
2. Sound Input auf `System` setzen.
3. Simulator und App neu starten.
4. Einen minimalen Recorder-/PCM-Test ausführen und prüfen, ob Chunks mit
   plausibler Sample-Rate und nicht nur Nullwerten ankommen.
5. Danach den Apple-Speech-Test ausführen und beide Werte loggen:
   `isRecognitionAvailable()` sowie den vollständigen nativen Fehler.
6. Erwartetes Ergebnis auf der aktuellen Umgebung: Audioinput kann eventuell
   funktionieren, die Speech-Task kann trotzdem mit
   `kLSRErrorDomain Code=300` abbrechen.
7. Den vollständigen nativen Fehler und die Audio-Session-Werte festhalten;
   keine Ursache aus dem Fehlercode allein ableiten.

### B. Simulator-Live-Test mit lokalem Whisper

1. Native Änderungen und Config-Plugin-Stand in einen neuen iOS-
   Development-Build aufnehmen.
2. Im Simulator `Device > Sound > Sound Input > System` wählen und die
   macOS-Mikrofonfreigabe für Simulator/Xcode prüfen.
3. Den Roh-Recorder starten und verifizieren, dass 16-kHz-mono-PCM-Chunks mit
   nicht-null Samples ankommen.
4. Whisper Tiny laden, `stream({ language: 'de' })` starten und die Chunks mit
   `streamInsert()` zuführen.
5. Mindestens drei deutsche Eingaben mit mehreren Einkaufsartikeln sprechen.
6. Den vollständigen Workflow inklusive Parser, Mengen/Einheiten, Preview und
   Bestätigung prüfen.
7. Den Apple-Provider im selben Simulator separat ausführen und den erwarteten
   Code-300-Fehler als bekannte Runtime-Diagnose protokollieren, nicht als
   Produktfehler des lokalen Whisper-Pfads.

### C. Deterministischer Simulator-/CI-Test

1. Eine kurze, versionierte deutsche Audio-Fixture definieren.
2. Fixture auf 16 kHz, mono, Float32 normalisieren.
3. Mit ExecuTorch `transcribe({ language: 'de' })` verarbeiten oder ein
   gespeichertes Transkript in den vorhandenen Adapter-/Parser-Test einspeisen.
4. Assertions auf Transkript, Artikelnamen, Mengen, Einheiten und Preview-
   Routing setzen.
5. Den nativen Apple-Live-Recognizer nicht als Voraussetzung für diesen Test
   verwenden.

## Schlussfolgerung

Die lokale Implementierung erreicht Metro, Native Module und Berechtigungen. Der
Fehler liegt danach in der Speech-/Audio-Schicht der Kombination aus
`expo-speech-recognition`, Apple `SFSpeechRecognizer` und iOS-Simulator 26.5.
Apples aktuelle Sound-Input-Dokumentation zeigt zugleich, dass der Simulator
einen Mac-Eingang nutzen kann. Eine belastbare simulator-only-Lösung ist daher,
den Einkaufsartikelplan auf den bereits eingebundenen lokalen Whisper-Provider
umzustellen und den Simulator-Eingang über `AudioRecorder` zuzuführen.

Der deterministische `transcribe()`-Fixturepfad bleibt zusätzlich wichtig für
CI und reproduzierbare Parser-/Routing-Tests. Der Live-Whisper-Pfad benötigt
weiterhin einen funktionierenden Simulator-Eingang, ist aber unabhängig von
der Initialisierung des Apple-Speech-Recognizers und damit der belastbare Weg,
echte Spracheingabe im Simulator zu testen.
