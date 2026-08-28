# Fam Entwickler- & Pipeline-Tools

Dieser Ordner enthält alle eigenständigen Entwickler- und Daten-Tools des Projekts. Alle Tools hier sind **strikt vom Mobile-App-Code getrennt** und dienen ausschließlich der Offline-Datenbeschaffung, Inspektion und Pipelines.

---

## 🛠️ Verfügbare Tools

### 1. [Prospekte- & Supermarkt-Crawler](file:///Users/marco/Github.tmp/family_app/fam/tools/crawler/brochures/README.md) (`tools/crawler/brochures/`)
- **Aufgabe:** Automatisches Crawlen aller deutschen Wochenprospekte (Lidl, Aldi, Kaufland, Rewe, Netto, Edeka, Rossmann, dm etc.).
- **Features:** Cloudflare R2 Bild-Hosting, Supabase Live-Streaming, 5-Etappen-Matrix für GitHub Actions, Absturzsicherung.
- **Befehl:** `bun run crawler:brochures`

### 2. Prospekte-Viewer (`tools/brochure-viewer/`)
- **Aufgabe:** Lokaler Web-Server zum visuellen Durchblättern und Testen gecrawlter Prospekte und Hotspots im Browser.
- **Befehl:** `bun run tools:brochures`

### 3. Category Debugger (`tools/category-debugger/`)
- **Aufgabe:** Test- und Debugging-Umgebung für den Lebensmittel-Kategorisierungs-Algorithmus (OFF-Taxonomie).
- **Befehl:** `bun run debugger:category`

### 4. Product Search Lab (`tools/product-search-lab/`)
- **Aufgabe:** Test-Tool zur Validierung von Barcode- und Volltextsuche im Offline-Produktkatalog.
