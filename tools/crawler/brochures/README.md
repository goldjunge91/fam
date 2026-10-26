# Prospektmetadaten und Bring-CDN

Der aktive Prospektpfad veröffentlicht regionale Prospektdaten und originale
Bring-Bild-URLs in Supabase. Die App lädt Bilder direkt von
`offerscdn.bringapi.app`. Der GitHub-Workflow lädt keine Bilddateien und
verwendet kein Cloudflare R2.

## Was der Crawler abfragt

1. Der Offers-Listing-Endpunkt wird pro PLZ abgefragt und liefert die dort
   verfügbaren Prospekte, ihre Gültigkeit und das Cover.
2. Der Detail-Endpunkt liefert die vollständigen Seiten-URLs und Hotspots als
   JSON. Diese Anfrage ist nötig, damit die App den vollständigen Prospekt
   anzeigen und lokal zwischenspeichern kann.
3. Supabase speichert jede regionale Ausgabe unter ihrer `(PLZ, BRN)`-Identität.
   Ein Prospekt aus einer PLZ erzeugt keine Verfügbarkeit in einer anderen.

## GitHub-Workflow

`.github/workflows/update-brochures.yml` läuft montags und donnerstags oder
manuell auf `main`. Vier Scan-Shards erfassen alle deutschen PLZ. Der Workflow
validiert Scan-Abdeckung und Handoffs, veröffentlicht Metadaten atomar nach
Supabase und kann einen fehlgeschlagenen Supabase-Publish aus dem geprüften
Handoff wiederholen.

Benötigte Secrets: Bring-Zugangsdaten sowie `SUPABASE_URL` und
`SUPABASE_SECRET_KEY` (oder die im Workflow dokumentierten Alternativen).
R2-Secrets sind nicht erforderlich.

Der letzte Vollscan enthielt 296.662 regionale `(PLZ, BRN)`-Referenzen. Direkte
Bild-URLs vermeiden Bilddownloads und Uploads, aber nicht die Detail-JSON-
Abfragen. Zwei bis drei Minuten sind deshalb für den vollständigen Lauf nicht
bestätigt. Der Detailjob bricht nach einem fehlgeschlagenen Batch ab und zeigt
die ersten Fehlerursachen.

## Lokale Phasen

Für einen lokalen Vollscan muss `BROCHURE_LOCATIONS_FILE` auf eine vollständige
deutsche GeoNames-PLZ-Datei zeigen:

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/all-stores-full.ts

bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/fetch-detail-pages.ts

bun run tools/crawler/brochures/listing-only/persist-canonical.ts
bun run tools/crawler/brochures/listing-only/canonical-report.ts
```

`fetch-detail-pages.ts` verwendet vollständige gültige Detaildaten aus Supabase
wieder, wenn dieselbe regionale Ausgabe und Gültigkeit vorliegen.

## Ältere Bildwerkzeuge

`tools/crawler/brochures/index.ts`, `r2-storage.ts` und
`listing-only/verify-full-brochures.ts` sind ältere lokale Bild- und
Hashanalysewerkzeuge. Sie gehören nicht zum aktiven Veröffentlichungsworkflow.
Der frühere Paketbefehl `crawler:brochures` wurde entfernt, damit der alte
Bild-Uploadpfad nicht versehentlich als aktueller Kataloglauf verwendet wird.
