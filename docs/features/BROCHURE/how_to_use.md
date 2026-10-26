# Prospekte: Bring-CDN direkt verwenden

Der aktive Prospektpfad speichert in Supabase die regionalen Prospektdaten und
originale Bild-URLs von Bring. Die App lädt Cover, Seiten, Händlerlogos und
Produktbilder direkt von `offerscdn.bringapi.app`. Der Crawler lädt keine
Bilddateien herunter und verwendet Cloudflare R2 nicht.

## GitHub-Workflow

`.github/workflows/update-brochures.yml` läuft montags und donnerstags auf
`main` oder manuell. Vier Scan-Shards lesen die Bring-Offers-Liste für alle
deutschen PLZ. Die Liste liefert das Cover; für vollständige Seiten und
Hotspots fragt der Workflow zusätzlich den Detail-Endpunkt nach JSON-
Metadaten. Danach veröffentlicht er den regionalen Katalog atomar in Supabase.

Der Workflow braucht Bring-Zugangsdaten und Supabase-URL sowie Secret-Key.
R2-Secrets und R2-Bereinigung gehören nicht zu diesem Ablauf. Reports und
validierte Handoffs bleiben als 30-Tage-GitHub-Artefakte verfügbar. Ein
fehlgeschlagener Supabase-Publish lässt sich aus dem geprüften Handoff
wiederholen, ohne Bring erneut abzufragen.

Die Detailmetadaten bleiben regional nach `(PLZ, BRN)` getrennt. Die App erhält
pro eingestellter PLZ nur die dort im Bring-Listing belegten Prospekte.

## App und Offline-Nutzung

Die App liest den PLZ-korrekten SQLite-Snapshot. `expo-image` lädt die originalen
Bring-URLs und verwendet seinen lokalen Disk-Cache. Der begrenzte Prefetch läuft
weiterhin nur über WLAN. Nach einem erfolgreichen Sync bleiben die gespeicherten
URLs samt Seiten und Hotspots für den lokalen Prospektviewer verfügbar.

Die lokale Zwischenspeicherung ist gerätegebunden. Sie ist kein gemeinsamer
Cloudflare-Cache. Bring kann Bilder nach Ablauf oder aufgrund eigener CDN-Regeln
entfernen.

## Lokale Crawler-Phasen

Mit gültigen Bring-Zugangsdaten lassen sich Scan und Detailmetadaten lokal
ausführen:

```bash
bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/all-stores-full.ts

bun --env-file=.env.development.local run \
  tools/crawler/brochures/listing-only/fetch-detail-pages.ts

bun run tools/crawler/brochures/listing-only/persist-canonical.ts
bun run tools/crawler/brochures/listing-only/canonical-report.ts
```

Diese Phasen arbeiten mit JSON-Metadaten und Bild-URLs. Separate historische
Werkzeuge zur lokalen Bildverifikation gehören nicht zum aktiven
Veröffentlichungsworkflow.

## Laufzeit

Der letzte Vollscan enthielt 296.662 regionale Prospektreferenzen. Direkter
Bildzugriff spart die Übertragung und Speicherung der Bilddateien; er entfernt
nicht die Detailabfragen, die alle Seiten-URLs und Hotspots liefern. Die
frühere Erwartung eines vollständigen Laufs in zwei bis drei Minuten ist daher
nicht bestätigt. Der Workflow bricht nach einem fehlerhaften Detailbatch ab und
zeigt die ersten Ursachen, damit API-Fehler nicht stundenlang weiterlaufen.
