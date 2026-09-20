# Primärquellen-Recherche: Optimierung des deutschen Einkaufslisten-Speech-Workflows

Stand: 18. September 2026  
Scope: iOS, deutscher On-Device-Speech-Pfad, Expo SDK 57, expo-speech-recognition 57.1.0, keine Codeänderungen.

## Kurzfazit

Der kleinste belastbare Qualitätshebel ist ein begrenztes, lokales Kontextlexikon
für den jeweiligen Haushalt. Apple beschreibt contextualStrings ausdrücklich als
Möglichkeit, app-spezifische Produkt- und Markennamen zu biasen; die Liste soll
aus kurzen Phrasen bestehen, möglichst ein bis zwei Wörter je Eintrag, und
höchstens 100 Einträge enthalten. Das verbessert die Erkennungswahrscheinlichkeit,
ist aber keine Genauigkeitsgarantie für unseren konkreten Warenbestand.
[Apple: contextualStrings](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/contextualstrings?language=objc)

Das bestehende Profil ist für den iOS-MVP grundsätzlich passend: de-DE,
On-Device-Erkennung, Punctuation, continuous und dictation. Die zwei
wahrscheinlichsten Effizienzgewinne sind:

1. maxAlternatives auf 1 zu reduzieren, solange der Adapter weiterhin nur das
   beste Ergebnis verwendet.
2. interimResults nur dann aktiviert zu lassen, wenn wir Zwischenstände wirklich
   anzeigen oder für die Sessionlogik benötigen. Der aktuelle Adapter verarbeitet
   ausschließlich finale Ergebnisse; der Effekt von interimResults=false auf
   native CPU- und Akkuverbrauch ist in den Primärquellen nicht quantifiziert und
   muss mit identischen Aufnahmen gemessen werden.

Apple nennt keine belastbaren Zahlen zu Latenz, CPU, Speicher oder Akku für die
einzelnen Optionen. Aussagen zu diesen Kosten sind daher ausdrücklich
Engineering-Inferenzen aus dem Datenfluss und dem Paketquelltext, keine
Apple-Garantien.

## Ausgangslage im Repository

Der aktuelle Adapter ist
[speech-recognition-adapter.ts](../../src/features/shopping-list/stt-beta/services/speech-recognition-adapter.ts).
Er startet derzeit mit:

| Option | Aktueller Wert | Befund |
| --- | --- | --- |
| Sprache | de-DE | Für den deutschen Scope beibehalten. |
| On-Device | true | Datenschutz- und Offline-Grenze; beibehalten. |
| interimResults | true | Der Adapter verwirft nicht-finale Ergebnisse. |
| maxAlternatives | 3 | Der Adapter verwendet anschließend nur results[0]. |
| continuous | true | Für lange Mehrfachartikel-Eingaben und explizites Stoppen sinnvoll. |
| addsPunctuation | true | Kann Kommas und Satzgrenzen für den Parser liefern. |
| iosTaskHint | dictation | Passt zu einer natürlichen, gesprochenen Eingabe. |
| contextualStrings | nicht gesetzt | Der klarste noch ungenutzte Apple-Hebel. |
| volumechange | optional, 100 ms | Nur aktiv, wenn der Overlay-Workflow einen Pegelhandler übergibt. |

Das installierte Paket bildet diese Optionen auf Apples
SFSpeechAudioBufferRecognitionRequest ab. Die maßgeblichen Stellen sind
[die Expo-Typen](https://github.com/jamsch/expo-speech-recognition/blob/main/src/ExpoSpeechRecognitionModule.types.ts),
[die iOS-Request-Erzeugung](https://github.com/jamsch/expo-speech-recognition/blob/main/ios/ExpoSpeechRecognizer.swift)
und [die Ergebnisweitergabe](https://github.com/jamsch/expo-speech-recognition/blob/main/ios/ExpoSpeechRecognitionModule.swift).

Die offiziellen Expo-SDK-57-Seiten liefern dafür keine alternative
Speech-to-Text-API: expo-speech ist Text-to-Speech, während expo-audio
Aufnahme und Wiedergabe anbietet.
[Expo SDK 57: Speech](https://docs.expo.dev/versions/v57.0.0/sdk/speech/)  
[Expo SDK 57: Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)

## 1. Optionen für Erkennungsqualität und Lifecycle

### Locale de-DE

Ein SFSpeechRecognizer arbeitet jeweils mit einer Sprache beziehungsweise Locale.
Apple stellt supportedLocales() bereit und weist darauf hin, dass die Erzeugung
eines Recognizers für eine nicht unterstützte Locale fehlschlagen kann. Eine
erfolgreiche Erzeugung bedeutet außerdem nicht, dass der Dienst im Moment
verfügbar ist. Deshalb ist de-DE als explizite Produktentscheidung richtig;
ein stiller Wechsel auf die Gerätesprache würde die deutsche Grammatik und die
Mengenwörter verschlechtern.
[Apple: SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer)  
[Apple: init(locale:)](https://developer.apple.com/documentation/speech/sfspeechrecognizer/init%28locale%3A%29)

Kleine sinnvolle Adaptermaßnahme: de-DE beibehalten und Locale-/Capability-Fehler
als diagnostisches Feld erfassen. Ein zusätzlicher supportedLocales-Aufruf vor
jeder einzelnen Session ist nicht automatisch besser; er sollte nur gecacht oder
für einen Capability-Screen verwendet werden, wenn wir dafür ein reales
Fehlerbild sehen.

### contextualStrings: priorisierter Qualitätshebel

Apple sagt, dass kurze app-spezifische Phrasen die Wahrscheinlichkeit ihrer
Erkennung erhöhen. Geeignet sind Produktnamen, Marken und ungewöhnliche Begriffe.
Apple empfiehlt ein bis zwei Wörter, keine langen Phrasen und maximal 100
Phrasen pro Request.
[Apple: contextualStrings](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/contextualstrings?language=objc)

Für den Einkaufsworkflow sollte die Liste vor dem Start lokal aus dem relevanten
Haushaltskontext gebildet werden:

- häufige oder zuletzt bestätigte Artikel,
- bestätigte Marken,
- kanonische Namen plus wenige lokale Aliasformen,
- längere Mehrwortbegriffe nur, wenn sie ohne Pause gesprochen werden.

Die Auswahl sollte gerankt und hart auf höchstens 100 Einträge begrenzt werden.
Eine sinnvolle erste Heuristik ist eine gemeinsame Liste aus Artikel- und
Markennamen; eine starre Aufteilung wie 60/40 ist jedoch eine
Implementierungsentscheidung und nicht durch Apple vorgegeben. Das Lexikon darf
nur die Transkription unterstützen und niemals allein eine Liste auswählen oder
einen Artikel speichern.

Das Paket reicht contextualStrings auf iOS direkt an die Apple-Request weiter:
[expo-speech-recognition iOS source](https://github.com/jamsch/expo-speech-recognition/blob/main/ios/ExpoSpeechRecognizer.swift).

### taskHint

Apple definiert die Hinweise semantisch, nicht als Rangliste für
Erkennungsgenauigkeit: dictation steht für Texteingabe, search für Suchbegriffe,
confirmation für kurze Bestätigungsanfragen und unspecified für einen nicht
klassifizierten Task.
[Apple: SFSpeechRecognitionTaskHint](https://developer.apple.com/documentation/speech/sfspeechrecognitiontaskhint)  
[Apple: taskHint](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/taskhint)

dictation bleibt für die aktuelle Eingabe der sichere Baseline-Hinweis, weil
unsere Nutzer vollständige natürliche Einkaufsäußerungen sprechen. search ist
ein sinnvoller A/B-Kandidat für kurze, komma-getrennte Produktlisten, aber keine
belegte Verbesserung für deutsche Einkaufsartikel. confirmation ist für diesen
Workflow nicht passend. Es gibt keinen Primärquellenbeleg, dass search für
Produktnamen generell besser ist als dictation.

### Partial- und Final-Results

Apple unterscheidet Zwischen- und Endergebnisse über
shouldReportPartialResults und isFinal. Zwischenresultate können nur einen Teil
der bisher gesprochenen Audiosequenz darstellen; transcriptions sind nach
Konfidenz absteigend sortiert und die erste Transkription ist die beste.
[Apple: SFSpeechRecognitionRequest](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest)  
[Apple: SFSpeechRecognitionResult](https://developer.apple.com/documentation/speech/sfspeechrecognitionresult)  
[Apple: transcriptions](https://developer.apple.com/documentation/speech/sfspeechrecognitionresult/transcriptions)

Der Expo-Adapter reicht maxAlternatives weiter. Im iOS-Paketquelltext werden bei
continuous mehrere Ergebnisabschnitte verarbeitet; außerdem existiert dort eine
iOS-18-Kompatibilitätsbehandlung für final-ähnliche Ergebnisse. Der aktuelle
App-Adapter nimmt nur event.results[0] von final markierten Events an.
[Expo README: Event- und Continuous-Verhalten](https://github.com/jamsch/expo-speech-recognition#readme)  
[Expo iOS result handling](https://github.com/jamsch/expo-speech-recognition/blob/main/ios/ExpoSpeechRecognitionModule.swift)

Konkrete Folgerung:

- maxAlternatives=1 ist für den aktuellen Consumer ausreichend und reduziert
  native Ergebnisobjekte, Bridge-Payload und JS-Speicher. Das ist eine
  begründete Performance-Inferenz, keine gemessene Apple-Zahl.
- interimResults=true liefert dem aktuellen Adapter keinen Produktnutzen,
  solange Zwischenresultate weder angezeigt noch bewertet werden. Eine
  Umstellung auf false sollte zuerst als fokussierter A/B-Test auf iOS 17+ und
  iOS 26.2 erfolgen, weil sich beim Paket die Stop-/Final-Semantik mit
  continuous und der iOS-18-Behandlung ändern kann.
- continuous=true sollte vorerst bleiben. Für lange Einkaufslisten verhindert
  das ein vorzeitiges Ende an kurzen Pausen; der Nutzer beendet die Session
  explizit. Die genaue Pause- und Final-Semantik ist paket- und iOS-versionsabhängig.

### Punctuation

Apple beschreibt addsPunctuation als automatische Einfügung von Punkt,
Fragezeichen am Satzende und Komma innerhalb eines Satzes.
[Apple: addsPunctuation](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/addspunctuation)

addsPunctuation=true bleibt sinnvoll, weil Kommas dem Parser ein zusätzliches,
weiches Grenzsignal geben können. Es ist kein Ersatz für Artikelgrammatik und
keine Garantie, dass jede Artikelgrenze punktuiert wird. Der Parser muss auch
ohne Satzzeichen korrekt und konservativ bleiben.

## 2. Latenz, CPU, Speicher und Energie

### On-Device-Erkennung

requiresOnDeviceRecognition=true verhindert laut Apple, dass die
SFSpeechRecognitionRequest Audiodaten über das Netzwerk sendet. Apple weist
gleichzeitig ausdrücklich darauf hin, dass On-Device-Anfragen weniger genau sein
können. Die Option ist daher primär eine Datenschutz- und Offline-Entscheidung,
nicht automatisch ein Qualitäts- oder Geschwindigkeitsmodus.
[Apple: requiresOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition)  
[Apple: supportsOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition)

Eine geringere Netzabhängigkeit kann die Latenz stabilisieren, ist aber eine
Inference und nicht von Apple als feste Latenzgarantie dokumentiert. Für den
aktuellen MVP bleibt true unverändert.

### Ergebnis- und Event-Menge

maxAlternatives und interimResults beeinflussen unmittelbar, wie viele
Ergebnisobjekte beziehungsweise Result-Events das Paket an JavaScript
weitergibt. Weniger Alternativen und keine ungenutzten Zwischenresultate
reduzieren voraussichtlich Bridge-Arbeit, Payload-Größe und kurzlebige
Objekte. Apple dokumentiert dafür keine CPU-, Speicher- oder Akkuwerte; diese
Auswirkung muss instrumentiert werden.

### Pegel-Events

Die Expo-Typdefinition dokumentiert für volumeChangeEventOptions, dass ein
größeres intervalMillis die Performance verbessert. Der Adapter aktiviert die
Events bereits nur bei Bedarf, derzeit mit 100 ms.
[Expo options source](https://github.com/jamsch/expo-speech-recognition/blob/main/src/ExpoSpeechRecognitionModule.types.ts)

Kleine Maßnahme: Falls die Pegelanzeige mit 200 bis 250 ms noch flüssig wirkt,
dies als A/B-Test prüfen. Wenn kein Pegel gebraucht wird, keinen Handler
übergeben. Der konkrete Intervallwert ist keine offizielle Empfehlung.

### Sessiondauer und Hintergrundbetrieb

Apple weist auf eine ungefähr einminütige Grenze für Speech-Recognition-Tasks und
auf eine relativ hohe Akku- und Netzbelastung hin. Unsere längsten geprüften
Einkaufsäußerungen liegen nahe an dieser Grenze. Eine Session sollte daher
frühzeitig beendet oder in eine zweite Äußerung geteilt werden, statt auf einen
nativen Timeout zu warten.
[Apple: SFSpeechRecognizer, Limits und Akku](https://developer.apple.com/documentation/speech/sfspeechrecognizer)

Für diesen Vordergrund-Workflow sollte kein Hintergrund-Recording aktiviert
werden. Expo warnt ausdrücklich, dass Hintergrundaufnahme die Akkulaufzeit
deutlich beeinflussen kann.
[Expo SDK 57: Audio, Hintergrundaufnahme](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)

### Voice processing und Audio-Session

expo-speech-recognition bietet iosVoiceProcessingEnabled an. Die Paketdoku
beschreibt zusätzliche Signalverarbeitung zur Unterdrückung von
Lautsprecher-Feedback und weist auf mögliche Änderungen der Audio-Session sowie
geringere Lautsprecherlautstärke hin.
[Expo README: Voice processing](https://github.com/jamsch/expo-speech-recognition#readme)

Das ist kein allgemeiner Qualitätshebel für die aktuelle Mikrofon-Eingabe.
Nicht aktivieren, solange kein reproduzierbares Echo- oder Feedbackproblem
vorliegt; bei echtem Feedback separat mit BlackHole und Hardware testen.

## 3. Grenzen und Gerätebedingungen

1. On-Device wird nur garantiert, wenn der Recognizer supportsOnDeviceRecognition
   meldet. Apple sagt ausdrücklich, dass requiresOnDeviceRecognition sonst nicht
   erfüllt werden kann und der Recognizer Netzwerk benötigt.
   [Apple: supportsOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition)
2. isAvailable ist eine Momentaufnahme, keine Startgarantie. Apple dokumentiert,
   dass der Dienst vorübergehend nicht verfügbar sein kann; der Adapter muss
   Startfehler und spätere native Fehler weiterhin abbilden.
   [Apple: SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer)
3. Die Locale kann nicht unterstützt sein. de-DE muss vor dem produktiven Start
   als Capability beziehungsweise Startfehler sichtbar bleiben.
   [Apple: init(locale:)](https://developer.apple.com/documentation/speech/sfspeechrecognizer/init%28locale%3A%29)
4. Apple dokumentiert eine etwa einminütige Laufzeitgrenze. Lange 39-Artikel-
   Eingaben sind deshalb kein beliebig skalierbarer Einzelrequest.
   [Apple: SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer)
5. Die Expo-Kompatibilitätstabelle des offiziellen Pakets weist iOS 17+ für
   Basic Speech Recognition, Continuous Recognition, Interim Results,
   On-Device Recognition, Contextual Strings und Punctuation aus.
   [expo-speech-recognition README: compatibility](https://github.com/jamsch/expo-speech-recognition#platform-compatibility-table)
6. Keine der hier zugelassenen Quellen belegt eine Gleichheit von Simulator- und
   Hardwarequalität. Der iPhone-11-Simulator bleibt daher ein reproduzierbares
   Testziel, aber kein Beweis für alle realen Mikrofon- und Gerätezustände.
   Diese letzte Aussage ist eine Testgrenze, keine Apple-Funktionsaussage.

## 4. Priorisierte Handlungsliste für den aktuellen Adapter

### P0: kleiner, lokaler Qualitätsgewinn ohne native Änderung

1. contextualStrings als lokale Request-Option ergänzen. Pro Session die
   relevantesten deutschen Artikel-, Marken- und Aliasnamen auswählen, auf
   höchstens 100 kurze Phrasen begrenzen und keine vollständigen Sätze
   einspeisen.
2. maxAlternatives auf 1 setzen, solange kein Consumer für Alternativen existiert.
   Die bestehende Nutzung des besten Ergebnisses bleibt dadurch semantisch
   unverändert.
3. de-DE, requiresOnDeviceRecognition=true, addsPunctuation=true,
   continuous=true und iosTaskHint=dictation zunächst unverändert lassen.

### P1: messen, dann entscheiden

4. Mit denselben 20 Audio-Fixtures einen A/B-Lauf für interimResults=true und
   false durchführen. Erfassen: Zeit bis zum ersten Result, Zeit bis zum finalen
   Transcript, Anzahl Result-Events, Item- und Feldgenauigkeit, unparsed text
   sowie Save-/Delete-Erfolg. false erst übernehmen, wenn die Final-/Stop-
   Semantik auf den unterstützten iOS-Versionen unverändert bleibt.
5. dictation gegen search mit kurzen und langen Einkaufsäußerungen vergleichen.
   Keine dauerhafte Umstellung allein aus der Bezeichnung ableiten.
6. Den bestehenden optionalen Pegelkanal mit 200 beziehungsweise 250 ms
   vergleichen. Bei fehlender Pegelanzeige deaktiviert lassen.
7. Eine app-seitige Sessiongrenze deutlich vor einer Minute prüfen, damit lange
   Eingaben kontrolliert in eine zweite Spracheingabe übergehen können. Der
   Grenzwert ist anhand echter Stop-/Preview-Latenzen zu wählen, nicht blind als
   Apple-Konstante zu behaupten.
8. Dev-only Diagnostik um Request-Profil, Result-Event-Anzahl,
   Alternatives-Anzahl, first-result/final-result-Latenz, Stop-/Abort-Grund und
   native Fehlercode erweitern. Roh-Audio und Produktions-Telemetrie bleiben
   außerhalb dieser Optimierung.

### P2: bewusst nicht als kleiner Adapterfix

9. Kein Wechsel zu expo-speech oder expo-audio für STT: die offiziellen Expo-
   SDK-57-Module bieten dafür keine passende Speech-to-Text-API.
10. Kein Custom Language Model und kein Wechsel auf eine neue Apple-Speech-
    Architektur in diesem Optimierungsschritt. Das wäre eine native
    Architekturentscheidung mit eigenem Rebuild-, Geräte- und Qualitätsrisiko,
    nicht nur eine Request-Option.
11. Android-Optionen und Android-Verifikation bleiben in den separat geplanten
    Android-Tasks.

## Unsicherheiten und Messgrenzen

- Apple belegt den Qualitätsnutzen von contextualStrings allgemein, aber nicht
  die Verbesserung für deutsche Einkaufslisten oder einzelne Begriffe.
- Apple belegt, dass On-Device weniger genau sein kann, aber keine feste
  Latenz-, CPU-, Speicher- oder Akkuwirkung der Umschaltung.
- Apple beschreibt taskHint semantisch, nicht als messbare Qualitätsrangfolge.
- Die Expo-Implementierung enthält iOS-18-spezifische Final-Result-
  Kompatibilitätslogik. Deshalb ist interimResults=false ein Messkandidat und
  kein sicherer Blindfix.
- Ein aussagekräftiger Qualitätsvergleich benötigt identische Aufnahmen,
  identische Locale, identische lokale Kontextliste und getrennte Messung von
  ASR, Parser und Save-Workflow. Parser- oder UI-Verbesserungen dürfen nicht
  nachträglich als Speech-Qualitätsgewinn ausgegeben werden.

