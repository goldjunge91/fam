
# Prospektbilder: Abruf, Prüfung und R2-Upload

**Aktuelle Veröffentlichungssperre:** Cloudflare-/R2-Uploads, Deploys,
Cutovers und andere Remote-Schreibvorgänge sind erst freigegeben, nachdem Marco
die lokal erzeugten Prospekte visuell geprüft und ausdrücklich freigegeben hat.
Das gilt auch für manuell gestartete und geplante GitHub Actions. Bis dahin nur
lokale Listing-only-Ausgaben verwenden.

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

## Bring-Bilder in den privaten Cloudflare-R2-Bucket hochladen

Die oben beschriebene Veröffentlichungssperre gilt auch für die folgenden
Produktionsbefehle.

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

## Listing-only: Vollscan und vollständige Prospektverifikation

Der Vollscan erfasst zuerst nur Bring-Angebote je PLZ. Danach werden echte
Seitenzahlen je BRN und verifiziert lokal danach alle Seitenbilder anhand ihrer
unveränderten Originalbytes. Die Pipeline schreibt keine Bilder nach R2 und
verändert Supabase nicht.

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/all-stores-full.ts

bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/fetch-detail-pages.ts

bun run tools/crawler/brochures/listing-only/group-canonical.ts

bun run tools/crawler/brochures/listing-only/metadata-candidates.ts

bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/verify-full-brochures.ts \
  --candidate-report=tools/crawler/data/listing-only/metadata-candidate-report.json \
  --budget-bytes=10737418240

bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/verify-full-brochures.ts \
  --zip-code=22043 \
  --budget-bytes=10737418240

bun run tools/crawler/brochures/listing-only/persist-canonical.ts
bun run tools/crawler/brochures/listing-only/canonical-report.ts
```

Der Gruppierungsschlüssel ist exakt `storeName + validFrom + validUntil +
detailPageCount`. Im Scan vom 2026-10-07 ergab er 119 Gruppen aus 217.178
Sichtungen, 4.550 BRNs und 10.813 PLZ. Titel und Bild-URL ändern diesen
Schlüssel nicht.

Die Standardausgaben liegen unter `tools/crawler/data/listing-only/`:
`all-stores-full.json`, `detail-pages.json`, `canonical-groups.json`,
`metadata-candidate-index.json`, `metadata-candidate-report.json`,
`canonical-page-verification.json`,
`.canonical-page-verification-progress.json`,
`canonical-page-verification-pilot.json`,
`.canonical-page-verification-pilot-progress.json`,
`canonical-page-verification-22043.json`, `page-assets-22043/`,
`review-sample-22043/`, `page-assets/<sha256>.bin`, `canonical-brochures.json` und
`canonical-report.json`; der Pilot speichert Bilder separat unter
`page-assets-pilot/`. Der 123-BRN-Händlerpilot ist unvollständig. Der gezielte
PLZ-Sample-Lauf für 22043 ist abgeschlossen: 25 BRNs, 22 Metadatengruppen und
590 Seitenreferenzen.

`metadata-candidates.ts` vergleicht die Metadatengruppen und Seite-1-SHAs mit
dem vorherigen lokalen Index. Ein fehlender Index startet die Historie; ein
ungültiger Index stoppt den Lauf. Metadaten und gleiche Titelbilder bleiben
Kandidaten und überspringen keine Bildabrufe. Der Report listet zusätzlich den
reproduzierbaren 32-Gruppen-Pilot für Kaufland, REWE und XXXLutz.

Der erste Vollseitenlauf liest diesen Bericht und schreibt getrennt nach
`canonical-page-verification-pilot.json`, `.canonical-page-verification-pilot-progress.json`
und `page-assets-pilot/`. Er prüft nur die ausgewählten BRNs derselben Cover-
Hash-Buckets; der Report kennzeichnet den Umfang als unvollständig. Ein späterer
Gesamtlauf verlangt zusätzlich `--all-brns` und darf erst nach eigener
Budget-/Laufentscheidung gestartet werden.

Ein PLZ-Sample startet mit `--zip-code=22043` und verwendet eigene Report- und
Asset-Pfade. Der Bericht umfasst alle im Vollscan für diese PLZ gelisteten
BRNs; bei einem anderen ZIP-Code ändern sich sowohl der Filter als auch der
Fortschrittsfingerabdruck.

`--budget-bytes` begrenzt die Größe der lokalen Originalseiten-Assets; das
Beispiel erlaubt 10 GiB. Ein unterbrochener Lauf kann mit identischem Input
fortgesetzt werden. Die Hashes entstehen vor einer möglichen Bildoptimierung.
Der Verifikationsbericht liegt unter
`canonical-page-verification.json`, die Originalbytes unter
`page-assets/<sha256>.bin`. Persistenz und Report schreiben
`canonical-brochures.json` und `canonical-report.json`.

Zusammengeführt werden nur BRNs mit gleichem Metadatenschlüssel, gleicher
Seitenzahl und identischem geordnetem SHA-256-Vektor sämtlicher Seitenbilder.
Abweichende Innenseiten bleiben getrennte Prospekte. Der Ablauf erzeugt kein
Cover-Manifest und verwendet weder visuelle Ähnlichkeit noch OCR als
Identitätsbeleg.

### Ergebnisstand 2026-10-07

- 10.813/10.813 PLZ, 0 Fehler.
- 217.178 Prospekt-Sichtungen, 4.550 BRNs und 22 Händler.
- 119 Metadaten-Gruppen nach `storeName + validFrom + validUntil +
  detailPageCount`.
- PLZ 22043: 25 BRNs, 25 unterschiedliche vollständige Seitenvektoren und 590
  vollständig geladene Seiten; lokale Sichtprobe unter
  `tools/crawler/data/listing-only/review-sample-22043/`.
- Exakte Prospektzahlen entstehen erst nach erfolgreicher
  Vollseitenverifikation; historische Cover- und OCR-Auswertungen sind kein
  aktiver Workflow.

### Bekannte Lücken

- **ALDI Nord fehlt komplett bei Bring** (0 BRNs in Nord-Städten). Nur
  ALDI Süd ist gelistet: 1 BRN für 4758 PLZ.
- Rossmann und dm erscheinen im Voll-Scan nicht.
- Es wird keine zweite ALDI-Nord-Quelle verwendet.
