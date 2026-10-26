# Prospekte nutzen

Die App liest die für die aktive PLZ veröffentlichten Prospekte aus Supabase
und schreibt sie in die lokale SQLite-Datenbank. Der lokale Stand bleibt bei
Netzwerkfehlern erhalten. Die App startet keinen Crawler und ruft KaufDA nicht
direkt auf.

## GitHub-Runner

Der KaufDA-Runner liegt in [`scripts/scrapers/run-kaufda.ts`](../../../scripts/scrapers/run-kaufda.ts)
und wird über [`.github/workflows/scrape-brochures.yml`](../../../.github/workflows/scrape-brochures.yml)
ausgeführt. Ein Lauf liest den vollständig paginierten KaufDA-Shelf für die
angefragte PLZ und übernimmt echte Prospekte aus allen Kategorien. KaufDA
entscheidet dadurch, welche Publisher und Prospekte an diesem Standort
verfügbar sind. Die App zeigt standardmäßig alle veröffentlichten
Prospekte der aktiven PLZ; Händler ohne Angebot für diese PLZ erscheinen dort
nicht. Der Runner prüft Seiten und Hotspots und veröffentlicht den ganzen
PLZ-Scope atomar. Die Bilder bleiben originale
Bonial-CDN-URLs; Bildbytes werden nicht durch den Runner übertragen.

Die App stellt einen Scanwunsch ein, wenn die aktive PLZ neu ist oder ihr
letzter erfolgreicher Scan mindestens fünf Tage zurückliegt. GitHub Actions
prüft diese Warteschlange alle 15 Minuten und startet nur für fällige PLZ
Scraper-Jobs. Je Prüfung werden höchstens 25 PLZ mit maximal vier parallelen
Jobs verarbeitet. Nicht verwendete PLZ werden nicht abgefragt. Manuell kann
eine einzelne PLZ geprüft oder die fällige Warteschlange abgearbeitet werden.
Ein Ein-PLZ-Dry-Run prüft die Live-Antworten ohne Supabase-Schreibzugriff und
ohne Übergabe von Datenbank-Zugangsdaten an den Runner-Schritt.

Supabase-Zugangsdaten stehen nur Läufen auf `main` zur Verfügung. Die
Scanwarteschlange enthält ausschließlich PLZ, die von einer App-Sitzung
angefragt wurden. Vollständige Scans über alle 10.813 PLZ finden nicht statt.

## Offline-Nutzung

Nach einem erfolgreichen Sync stehen Prospektdaten und Hotspots in SQLite zur
Verfügung. Bilder werden über die gespeicherten Bonial-CDN-URLs mit
`expo-image` geladen; offline erscheinen sie, wenn sie bereits im Bildcache
liegen. Der Bild-Prefetch ist begrenzt. Bei Fehlern bleibt der vorherige
SQLite-Stand bestehen; ein leerer, vollständig veröffentlichter PLZ-Scope wird
als leerer Bestand übernommen.

## Lokaler Dry-Run

Mit `--dry-run` werden alle Shelf-Seiten und Prospektabrufe für eine PLZ geprüft, ohne eine
Datenbankverbindung oder lokale JSON-Ausgabe zu benötigen:

```bash
bun run scripts/scrapers/run-kaufda.ts --zip 22043 --dry-run
```

Für einen echten Publish wird der GitHub-Workflow verwendet; die App enthält
keine Crawler-Zugangsdaten.
