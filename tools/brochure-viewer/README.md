# 🛒 Supermarkt-Prospekte & Angebote (Bring! API Integration)

Dokumentation der entschlüsselten API-Struktur, Datenmodelle, Dateigrößen und Integrations-Strategie für Haushaltsapp.

---

## 1. Architektur & Endpunkte

### Basis-Konfiguration
* **Base URL:** `https://production.bringapi.app`
* **CDN URL:** `https://offerscdn.bringapi.app`
* **API Key:** ausschließlich über `BRING_API_KEY`
* **Client Type:** `iOS` / Version `4.110.0`
* **Default Country:** `DE` (unterstützt auch `AT`, `CH`)

### Standard Headers
```http
Authorization: Bearer <token>
X-BRING-API-KEY: <api-key>
X-BRING-CLIENT: iOS
X-BRING-COUNTRY: DE
X-BRING-VERSION: 4.110.0
X-BRING-USER-UUID: <uuid>
Accept: application/json
Accept-Language: de-DE
```

---

## 2. Die Endpunkte im Detail

### 1. Prospekte nach Postleitzahl / Koordinaten
```http
GET /offers/rest/v1/offers?type=brochure&providerId=bring-de&lat={lat}&long={long}&zipCode={plz}
```
* **Liefert:** Liste aller aktiven Supermarkt-Prospekte (Netto, Kaufland, Lidl, Rewe, Edeka, Möbel Boss, XXXLutz etc.).
* **Felder:** `brn`, `title`, `activeFrom`, `activeTo`, `company` (Name, Logo), `store` (Adresse), `pages[0]` (Deckblatt).

### 2. Einzelnes Prospekt mit allen Seiten & klickbaren Hotspots
```http
GET /offers/rest/v1/offers/brochures/{brn}?brochureId={brn}&lat={lat}&long={long}&providerId=bring-de&zipCode={plz}
```
* **Liefert:** Alle Einzelseiten (z. B. 68 Seiten bei Netto, 71 Seiten bei Kaufland) in 1500x2000 px Auflösung.
* **Pro Seite:**
  * `image.imageUrl`: Hochauflösendes JPEG
  * `discounts[]`: Klickbare Artikel auf der Seite mit genauen Prozent-Koordinaten (`top`, `left`, `width`, `height`)
  * `linkouts[]`: Optionale externe Werbelinks mit Bounding Box

### 3. Wöchentliche strukturierte Einzelangebote (Discounts API)
```http
POST /discounts/rest/v1/discounts/providers/{providerId}/mappings?sort=custom,LIST,PANTRY,RECENT&includeAllDiscounts=true
```
* **Provider-IDs:** `netto`, `edeka-nord`, `penny` etc.
* **Body:** `{ "items": [{ "itemId": "Kaffee", "source": "LIST" }] }`
* **Liefert:** Alle aktuellen Einzelangebote der Woche (z. B. 194 Netto-Artikel, 161 Penny-Artikel).

---

## 3. Gelieferte Datenfelder

| Feld | Typ | Beispiel | Beschreibung |
| :--- | :--- | :--- | :--- |
| **`name`** | String | `"Barilla Pasta"` | Produktname / Marke |
| **`price`** | Integer | `129` | Aktueller Angebotspreis in Cents (`1,29 €`) |
| **`oldPrice`** | Integer | `149` | Vorheriger Preis / Normalpreis (`1,49 €`) |
| **`discount`** | String | `"-13%"` / `"-50%"` | Rabatt-Prozentsatz oder Aktion |
| **`description`** | String | `"500 g (1 kg = 1.76)"` | Packungsgröße & Grundpreis |
| **`currency`** | String | `"EUR"` | Währung |
| **`imageUrl`** | String | `"https://..."` | Freigestelltes Produktbild |
| **`activeFrom` / `activeTo`** | ISO Date | `"2026-08-24T..."` | Gültigkeitszeitraum des Angebots |
| **`category` / `newItemSection`** | String | `"Fleisch & Wurst"` | Haushaltsapp-Kategorie |
| **`providerDiscountId`** | String | `"416769"` | Markt-interne Artikelnummer |
| **`coordinates`** | Object | `{ top, left, width, height }` | Bounding Box auf der Prospektseite (0.0 – 1.0) |

> ℹ️ **Hinweis zur EAN (Barcode):**  
> Die Werbedaten enthalten keine 13-stellige GTIN/EAN. Die Verknüpfung zu EAN, Nährwerten und Nutri-Score erfolgt in Haushaltsapp über den Text-Match mit der Open Food Facts Datenbank (`src/lib/open-food-facts.ts`).

---

## 4. Gemessene Datengrößen & Caching

| Datenart | Rohgröße (JSON / Bild) | Komprimiert (HTTPS) | Ladezeit |
| :--- | :--- | :--- | :--- |
| **PLZ-Prospektliste (26 Märkte)** | ~67 KB | ~11 KB | < 100 ms |
| **Kaufland Prospekt (71 Seiten + Hotspots)** | ~295 KB | ~30 KB | ~120 ms |
| **Deckblatt / Thumbnail (500x650)** | ~100 KB | – | Sofort |
| **High-Res Prospektseite (1500x1950)** | ~520 KB | – | Lazy on Scroll |

---

## 5. Lokaler Showcase- & Test-Server

Im Ordner `tools/brochure-viewer/` befindet sich der voll funktionsfähige Web-Viewer mit:
* PLZ-Suche & Schnellauswahl
* Markt-Filtern (Lidl, Edeka, Netto, Kaufland etc.)
* Interaktivem Blätter-Reader mit Tastatursteuerung (`◀` / `▶`, `Space`, `ESC`)
* Klickbaren Hotspots & automatischem Bildausschnitt-Modal mit Mengen-Stepper und Einkaufsliste
* Integriertem Image-Proxy gegen CORS-Probleme

### Starten:
```bash
bun --env-file=.env run tools:brochures
# Öffnet http://localhost:3333 im Browser
```

Benötigte lokale Variablen stehen in `.env.example`: `BRING_AUTH_TOKEN`,
`BRING_API_KEY` und `BRING_USER_UUID`.

---

## 6. Wöchentliche Dump-Pipeline

`.github/workflows/update-brochures.yml` läuft montags und kann zusätzlich
manuell gestartet werden. Der Job lädt die aktuellen Prospekte, transformiert
`discounts[]` in das Fam-Hotspot-Format und schreibt je PLZ genau den neuesten
Dump nach Supabase. Der vorherige Dump wird erst nach einem erfolgreichen
Insert entfernt.

Repository Secrets:

* `BRING_AUTH_TOKEN`
* `BRING_API_KEY`
* `BRING_USER_UUID`
* `SUPABASE_URL`
* `SUPABASE_SECRET_KEY`

Der Workflow lädt automatisch den vollständigen deutschen PLZ-Datensatz von
[GeoNames](https://www.geonames.org/) (CC BY 4.0), verdichtet mehrfach
vorkommende Ortszeilen auf einen Mittelpunkt je PLZ und verarbeitet alle
fünfstelligen Codes. Identische Bring-Prospekte werden während des Laufs anhand
ihrer `brn` wiederverwendet.

Lokaler Dry-Run ohne Supabase-Schreibzugriff:

```bash
BROCHURE_LOCATIONS_JSON='[{"zipCode":"22043","latitude":53.572433,"longitude":10.09511}]' \
  bun --env-file=.env run brochures:update --dry-run
```
