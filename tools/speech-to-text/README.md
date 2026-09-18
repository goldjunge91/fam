# Speech-to-text test audio generator

Dieses eigenständige Host-Tool wandelt Datensätze aus JSON oder CSV in Audio-Snippets für die Speech-to-Text-Tests um. Es ist nicht Teil des Expo-Bundles und nutzt keine Datei-API der App.

Die eigentliche Audioerzeugung läuft lokal auf macOS über:

- `/usr/bin/say` für die Sprachsynthese
- `afconvert` für 16-kHz-Mono-WAV
- optional `ffmpeg` für MP3

## JSON

Ein Array mit `text` und optional `id` genügt. Die zusätzlichen Felder bleiben im Eingabedatensatz erlaubt und müssen nicht in die Audiodatei übernommen werden.

```json
[
  {
    "id": "01_eigenmarken",
    "market": "EDEKA",
    "articleCount": 24,
    "text": "Gut und Günstig Milch, Gut und Günstig Butter und ..."
  }
]
```

`records`, `data` oder `items` als Wrapper werden ebenfalls akzeptiert. Als Textfelder werden automatisch `text`, `sentence`, `prompt`, `transcript` und `utterance` erkannt. Für andere Namen `--text-field` verwenden.

## CSV

Die erste Zeile ist die Kopfzeile. Kommas in Texten müssen nach RFC 4180 in doppelte Anführungszeichen gesetzt werden. Für deutsche Semikolon-CSVs:

```csv
id;text;market
01_eigenmarken;"Gut und Günstig Milch, Gut und Günstig Butter";EDEKA
```

## Verwendung

Nur WAV für BlackHole beziehungsweise die Simulator-Eingabe:

```bash
bun run tools/speech-to-text/index.ts /private/tmp/eigenmarken.json \
  --output-dir /private/tmp/eigenmarken-audio \
  --voice Anna \
  --rate 175 \
  --formats wav \
  --force
```

WAV und MP3 erzeugen:

```bash
bun run tools/speech-to-text/index.ts eigenmarken.csv \
  --delimiter ';' \
  --formats wav,mp3 \
  --output-dir ./audio/eigenmarken \
  --force
```

Vor der Erzeugung können die konkreten Befehle geprüft werden:

```bash
bun run tools/speech-to-text/index.ts eigenmarken.json --formats wav,mp3 --dry-run
```

Pro Lauf wird zusätzlich `manifest.json` mit der Zuordnung von Datensatz, gesprochenem Text und erzeugten Dateien geschrieben. Ohne `--force` werden bestehende Zieldateien nicht überschrieben.

## Tests

```bash
bun run tools/speech-to-text/core.test.ts
```
