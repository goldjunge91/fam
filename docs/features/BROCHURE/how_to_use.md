
# Prospektbilder: Abruf, Prüfung und R2-Upload

## Edge Function bereitstellen

Das Deploy-Script liest R2-Variablen aus deiner Env-Datei, setzt sie als
Supabase-Function-Secrets und stellt danach die Function bereit. Es lädt keine
Bilddateien in Cloudflare hoch.

**Aufruf:**

```
bash scripts/deploy-brochure-image.sh --env .env.development.local
```

**Nur Secrets setzen, ohne Deploy:**

```
bash scripts/deploy-brochure-image.sh --env .env.development.local --no-deploy
```

**Was das Script macht:**

1. Prüft, dass die vier Pflicht-Variablen in der Env-Datei vorhanden sind: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Fehlt eine, bricht es mit klarer Fehlermeldung ab.
2. Verlinkt das Supabase-Projekt (`supabase link --project-ref ivvebtqasotqpikuydov` — die Ref steht in `supabase/.temp/project-ref`).
3. Setzt die Secrets mit `supabase secrets set` (unterstützt optional auch `BROCHURE_IMAGE_TTL_SECONDS`, falls du in der Env-Datei eine andere TTL als 60 Sekunden willst).
4. Deployt die Function mit `supabase functions deploy brochure-image`.

## Duplikate eines Händler-Samples prüfen

Der Händler-Sample-Crawler lädt Bilder nur auf die Festplatte. Er schreibt
nicht nach Cloudflare R2 oder Supabase. Das Verzeichnis enthält `manifest.json`
und den Bildcache unter `assets/`.

```bash
SAMPLE_DIR="tools/crawler/data/retailer-full-v5-100"

bun --env-file=.env.development.local run tools/crawler/brochures/aldi-sample-v2.ts \
  --sample-size=1000 \
  --concurrency=12 \
  --pages=all \
  --stores=lidl,kaufland,netto,rewe \
  --output-dir="$SAMPLE_DIR"
```

Der Dateiname `aldi-sample-v2.ts` ist historisch; der Lauf kann mit
`--stores` auch Lidl, Kaufland, Netto und REWE abfragen. Das gleiche
Ausgabeverzeichnis bewahrt den Bildcache für einen späteren Lauf. Es ersetzt
aber nicht die Abfragen an Bring: Bereits besuchte PLZ werden erneut abgefragt.
Wenn `manifest.json` fehlt, beginnt der Lauf ohne vorhandenen Sample-Stand.

Nach dem Sample-Lauf zeigt `manifest.json` exakte Bildduplikate über
`summary.duplicatePageReferences`, eingesparte Bilddaten über
`summary.duplicateBytes` und den Anteil über `summary.deduplicationPercent`.
Diese Werte zählen byte-identische Bilddateien, nicht doppelte Prospekt-Ausgaben.

Für ähnliche oder identische Prospekt-Ausgaben desselben Händlers die
Versionen zusätzlich vergleichen:

```bash
bun run tools/crawler/brochures/verify-versions.ts \
  --manifest="$SAMPLE_DIR/manifest.json" \
  --ocr \
  --ocr-concurrency=4

jq '.summary | {
  exactDuplicateRecords,
  autoIdenticalPairs,
  autoRegionalVariantPairs,
  autoDifferentPairs,
  autoUncertainPairs,
  automaticSemanticGroups
}' "$SAMPLE_DIR/verification-report.json"
```

`exactDuplicateRecords` zählt zusätzliche vollständige Prospekt-Datensätze mit
derselben Inhalts-Signatur. `autoIdenticalPairs` zählt danach erkannte
Kandidatenpaare mit ähnlichem, aber nicht byte-identischem Inhalt. Das sind
Paarzahlen, keine Anzahl von Dateien. Regionale Varianten, unterschiedliche
Ausgaben und unklare Fälle bleiben separate Kategorien. Der Vergleich erfolgt
zwischen Ausgaben desselben Händlers und Gültigkeitszeitraums. Nur `identical`
ist für ein automatisches Zusammenführen gedacht; `uncertain` bleibt getrennt.

Die Stichprobe schreibt lokal und kann mehrere Gigabyte belegen. Prüfe vor dem
Start, dass das Ziellaufwerk Platz hat. Die frühere Dokumentation nennt einen
732-PLZ-Checkpoint im Verzeichnis `retailer-full-v5-100`; wenn dort kein
`manifest.json` und kein `assets/` liegen, kann dieser Lauf nicht fortgesetzt
werden.

## Optionale KI-Anreicherung mit OpenRouter

Das ist eine eigene Analyse des Haupt-Crawler-Backups. Sie liest nicht das
`manifest.json` des Händler-Samples. Für das Händler-Sample nutze die oben
beschriebene `verify-versions.ts`-Analyse mit lokalem OCR.

Die OpenRouter-Variante gruppiert Prospekte mit byte-identischen
Seitenfolgen und bittet ein Vision-Modell um Händler, Titel und sichtbare
Gültigkeitsdaten. Sie fasst keine Prospekte zusammen und entscheidet nicht,
welche Prospekte identisch sind. Dafür muss das Bildverzeichnis die
Objektstruktur des Backups enthalten, zum Beispiel
`brochures/dumps/assets/...jpg`. Außerdem wird `jq` benötigt, um das Backup zu
lesen.

`OPENROUTER_API_KEY` muss in `.env.development.local` gesetzt sein. Optional
kannst du dort `OPENROUTER_MODEL` festlegen. Ohne `--ai` läuft die SHA-Analyse
lokal und überträgt keine Bilder an OpenRouter.

```bash
ANALYSIS_DIR="tools/crawler/data/brochure-images"

bun --env-file=.env.development.local run scripts/analyze-brochure-versions.ts \
  --input-dir="$ANALYSIS_DIR" \
  --ai \
  --ai-max-calls=20 \
  --output="$ANALYSIS_DIR/brochure-version-analysis.json" \
  --cache="$ANALYSIS_DIR/.brochure-version-hashes.json"
```

Die Analyse schickt pro erkannter Inhaltsgruppe einen verkleinerten Kontaktbogen
mit bis zu vier Prospektseiten an OpenRouter. `--ai-max-calls` begrenzt die
Anzahl der API-Aufrufe; Standard sind 20. Das ist eine Aufrufgrenze, kein
festes Kostenlimit. Für einen kleinen Probelauf kannst du `--ai-max-calls=1`
setzen. `--ai-max-tokens` begrenzt die Modellantwort pro Anfrage; Standard sind
300 Tokens. Die tatsächlichen Aufrufe und das
verwendete Modell stehen im JSON-Ergebnis unter `ai.callsMade` und `ai.model`.
Die Ergebnisse liegen unter `ai.annotations`; ohne KI-Flag wird dieser Abschnitt
nicht erzeugt.

`ANALYSIS_DIR` muss auf denselben lokalen Stammordner zeigen, den du beim Crawl
mit `--local-dir` angegeben hast. Das Beispiel nutzt den ignorierten Projektpfad
`tools/crawler/data/brochure-images`; stelle sicher, dass dort Bilder liegen.
Ohne `--backup` nutzt das Skript das aktuelle Crawler-Backup
`tools/crawler/brochures/last_crawl_backup.json`. Dieses Backup muss zum
Bildbestand passen, sonst werden fehlende Seiten gemeldet und können nicht
analysiert werden.

Der im älteren README erwähnte Befehl `bun run analyze:brochure-versions` ist
aktuell nicht in `package.json` registriert. Verwende deshalb den direkten
Dateipfad `scripts/analyze-brochure-versions.ts` wie oben.

## Bring-Bilder in den privaten Cloudflare-R2-Bucket hochladen

Der unterstützte Upload läuft über den Haupt-Crawler. Er lädt Bilder aus der
Bring-API herunter, optimiert sie, legt sie privat im Bucket `r2-broschure` ab
und veröffentlicht vollständige Seiten samt Hotspots in `canonical_brochures`.
`brochure_availability` verknüpft die Bild-Cluster mit ihren PLZ. Für den
Abruf in der App muss die Edge Function `brochure-image` ebenfalls
bereitgestellt sein.

In `.env.development.local` müssen gesetzt sein:

- Bring: `BRING_AUTH_TOKEN`, `BRING_API_KEY`, `BRING_USER_UUID`
- Supabase: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET=r2-broschure`

Der Cloudflare-R2-API-Token braucht `Object Read & Write` für genau diesen
Bucket. Er braucht keine Account-Adminrechte.

Ein kleiner Lauf für eine PLZ:

```bash
bun --env-file=.env.development.local run crawler:brochures \
  --plz=22043 \
  --concurrency=1
```

Vor dem Upload muss die Ausgabe `R2-Bild-Hosting: JA (private Schlüssel im
Katalog)` melden. Ohne R2-Werte bricht eine Veröffentlichung ab, damit keine
Original-URLs in den Katalog gelangen. `--dry-run` schaltet den R2- und
Supabase-Upload aus. Der Workflow benötigt keine `R2_PUBLIC_URL`; der Bucket
bleibt privat.
Vor einem größeren Lauf erst den Ein-PLZ-Lauf prüfen.

`deploy-brochure-image.sh` lädt keine Bilddateien hoch. Es setzt nur die
R2-Zugangsdaten als Supabase-Function-Secrets und stellt die Function bereit.
Für einzelne Dateien aus einem beliebigen lokalen Ordner gibt es derzeit kein
projekt-eigenes Upload-Kommando. Ein manuell in R2 abgelegtes Bild wird erst
nutzbar, wenn sein Objekt-Key unter `brochures/dumps/` liegt und derselbe Key
auch in den passenden Supabase-Prospektdaten steht. Zugangsschlüssel niemals
in Befehlsargumente, Logs oder Dokumentation kopieren.

## Listing-Only: vollständiger Händler-/Prospekt-Scan ohne Bild-Download

`listing-only/all-stores-full.ts` fragt für alle 10813 deutschen PLZ nur die
Bring-Offers-Liste ab (kein Detail-Call, kein Bild-Download, kein R2/Supabase)
und schreibt atomar `tools/crawler/data/listing-only/all-stores-full.json`.
Der Lauf ist fortsetzbar: schon geladene PLZ werden übersprungen.

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/all-stores-full.ts
```

Metriken für einzelne PLZ ohne Bild-Download:

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/dump-plz.ts --plz=22043
```

Radius-Scan über 12 Städte für einen BRN oder Händler:

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/radius-scan.ts \
  --store=kaufland --raster=major
```

### Ergebnisstand 2026-10-07

- 10813/10813 PLZ, 0 Fehler.
- 217178 Prospekt-Sichtungen, 4550 einzigartige BRNs, 22 Händler.
- 119 Metadaten-Gruppen mit echten Detail-Seitenzahlen
  (`storeName + validFrom + validUntil + detailPageCount`, siehe unten).
- Offers-Liste liefert `pageCount` immer 1; die echte Seitenzahl kommt nur im
  Detail-Call. Gruppen mit gleichem Cover, Gültigkeit und Händler sind daher
  vermutlich dieselbe Ausgabe.
- Naiver Crawl: 217178 Sichtungen. Mit 119 Metadaten-Gruppen und den
  verifizierten regionalen Hash-Varianten ergeben sich 3126 gespeicherte
  Bild-Cluster.

### Canonical-Pipeline (Beads fam-kl22)

1. Gruppieren nach `storeName + validFrom + validUntil + detailPageCount`.
2. Je BRN Seite 1 laden und SHA-256 innerhalb jeder Metadaten-Gruppe
   vergleichen.
3. Je bestätigtem Hash-Cluster einen Datensatz mit `availableZipCodes`
   persistieren. Regionale Hash-Varianten bleiben getrennt.
4. Der Haupt-Crawler veröffentlicht Katalog und PLZ-Verfügbarkeit atomar; die
   App lädt die passende PLZ in die bestehende lokale SQLite-Form und nutzt die
   vorhandenen Übersichts- und Viewer-Screens.
5. Der Bericht vergleicht naive Sichtungen mit gespeicherten Bild-Clustern.

### Bekannte Lücken

- **ALDI Nord fehlt komplett bei Bring** (0 BRNs in Nord-Städten). Nur
  ALDI Süd ist gelistet: 1 BRN für 4758 PLZ.
- Rossmann und dm erscheinen im Voll-Scan nicht.
- Details je Händler siehe `BROCHURE_DEDUPLICATION_ANALYSIS.md`.
