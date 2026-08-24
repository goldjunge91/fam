import gzip
import io
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import os
from datetime import datetime, timezone

# Dynamische Pfade: standardmaessig im selben Ordner wie das Skript selbst,
# ueberschreibbar per DUMP_DATA_DIR (z.B. externe Platte statt interner SSD —
# der volle Export ist komprimiert ~12,7 GB, unkomprimiert beim Streamen
# entsprechend mehr).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DUMP_DATA_DIR", SCRIPT_DIR)
LOCAL_GZ_FILE = os.path.join(DATA_DIR, "off_dump.jsonl.gz")
OUTPUT_DB = os.path.join(DATA_DIR, "products_de.db")

# Schnellerer JSON-Parser fuer die Hauptschleife (2-5x ggue. json.loads bei
# diesem Datenvolumen). Faellt sauber auf die Standardbibliothek zurueck,
# wenn orjson nicht installiert ist — funktional identisch (orjson.loads()
# hat dieselbe Signatur, beide Fehlerklassen sind ValueError-Subklassen).
try:
    import orjson as _json_backend
    _JSON_BACKEND_NAME = "orjson"
except ImportError:
    _json_backend = json
    _JSON_BACKEND_NAME = "json (Standardbibliothek — 'pip install orjson' fuer 2-5x schnelleres Parsen)"

OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
TARGET_COUNTRY_TAG = "en:germany"
# Roh-Substring, wie der Tag als JSON-String in der Zeile auftaucht — fuer
# den Vorfilter vor dem eigentlichen JSON-Parsing (siehe Hauptschleife).
GERMANY_MARKER = f'"{TARGET_COUNTRY_TAG}"'

# Schema 3 (Bild-URL fuers "front"-Produktfoto, siehe extract_front_image_url)
# — alte Schema-Versionen werden gelöscht, nicht migriert. Siehe
# openfoodfacts.sql für die dokumentierte Referenz.
SCHEMA_VERSION = 3


def extract_nutrient(item, key):
    """Liest einen Naehrwert je 100g/100ml aus einem OFF-Produkt.

    Bug-Fix (#Rezept-Vorlagen): Der bisherige Code las ausschliesslich den
    `<feld>_100g`-Schluessel. Viele OFF-Eintraege fuehren denselben Wert aber
    nur unter dem Basis-Schluessel (`<feld>`, ohne Suffix) oder ausschliesslich
    als `<feld>_serving` + `serving_quantity` (Gramm/ml pro Portion). Ohne
    Fallback blieb der Grossteil der Zeilen leer (siehe Recherche-Notiz unten:
    von rund 405.000 deutschen Zeilen im zuletzt veroeffentlichten Dump hatten
    nur 88 vollstaendige Kern-Naehrwerte).

    Reihenfolge: `<feld>_100g` -> `<feld>` (viele Beitraege melden implizit
    pro 100g/ml ohne Suffix) -> aus `<feld>_serving` + `serving_quantity`
    hochgerechnet.
    """
    nutriments = item.get("nutriments") or {}

    for suffix in ("_100g", ""):
        raw = nutriments.get(f"{key}{suffix}")
        if raw is None:
            continue
        try:
            return float(raw)
        except (TypeError, ValueError):
            continue

    serving_raw = nutriments.get(f"{key}_serving")
    serving_size_g = item.get("serving_quantity")
    if serving_raw is not None and serving_size_g:
        try:
            serving_val = float(serving_raw)
            size_g = float(serving_size_g)
            if size_g > 0:
                return serving_val * 100.0 / size_g
        except (TypeError, ValueError):
            pass

    # Sonderfall Energie: sehr viele Eintraege fuehren nur "energy" (kJ) statt
    # "energy-kcal", weil kJ die EU-Pflichtangabe ist und kcal optional dazu
    # kommt. 1 kcal = 4.184 kJ.
    if key == "energy-kcal":
        kj = extract_nutrient(item, "energy")
        if kj is not None:
            return kj / 4.184

    return None


def extract_category_tags(item):
    """Kanonische `categories_tags` unveraendert uebernehmen (#223 Paket 4).

    Nur String-Eintraege (OFF liefert vereinzelt kaputte/nicht-String-Werte),
    als JSON-Array-Text fuer SQLite serialisiert. Deckt sich mit dem
    TS-seitigen Parser in formatOFFProduct() (src/lib/open-food-facts.ts) —
    "jeder Mapperpfad liefert dieselben Daten wie die Live-Suche".
    """
    raw_tags = item.get("categories_tags") or []
    tags = [tag for tag in raw_tags if isinstance(tag, str)]
    return json.dumps(tags)


_IMAGE_SIZE_PREFERENCE = ("400", "200", "100", "full")


def _barcode_folder(code):
    """Spiegelt `barcodeFolder()` in tools/category-debugger/scripts/image-manifest-v2.ts —
    dieselbe Ordnerstruktur, die images.openfoodfacts.org fuer Produktbilder nutzt."""
    padded = code.rjust(13, "0") if len(code) < 13 else code
    if len(padded) > 8:
        return f"{padded[0:3]}/{padded[3:6]}/{padded[6:9]}/{padded[9:]}"
    return padded


def _preferred_image_language(available_languages, item):
    available = sorted(available_languages)
    product_languages = []
    for key in ("lc", "lang"):
        value = item.get(key)
        if isinstance(value, str) and 2 <= len(value) <= 3 and value.isalpha():
            product_languages.append(value.lower())
    for language in ["de", *product_languages, "en"]:
        if language in available:
            return language
    return available[0] if available else None


def extract_front_image_url(item):
    """Bild-URL des "front"-Produktfotos (#Bilder-Anzeige lokaler Dump).

    Portierte, front-only Teilmenge von `extractManifestImages()` in
    tools/category-debugger/scripts/image-manifest-v2.ts — dort ausfuehrlich
    dokumentiert samt Regressionstests gegen echte Dump-Zeilen. Der aktuelle
    OFF-Export traegt Bild-Metadaten verschachtelt unter
    `images.selected.front.<language>` (rev/imgid/sizes); ein kleinerer,
    zuletzt lange nicht bearbeiteter Teil der Produkte hat noch das aeltere
    flache Format `images.front_<language>`. Beide werden unterstuetzt.
    Ein top-level `selected_images`-Feld mit fertigen URLs existiert im
    aktuellen Export nicht mehr (Stichprobe 2026-08: 0 von 5000 DE-Produkten).
    """
    images = item.get("images")
    if not isinstance(images, dict):
        return None

    nested = images.get("selected")
    nested_front = nested.get("front") if isinstance(nested, dict) else None
    nested_languages = (
        [lang for lang, meta in nested_front.items() if isinstance(meta, dict)]
        if isinstance(nested_front, dict)
        else []
    )
    flat_languages = [
        key[len("front_"):]
        for key, value in images.items()
        if key.startswith("front_") and isinstance(value, dict) and key != "front_"
    ]

    language = _preferred_image_language({*nested_languages, *flat_languages}, item)
    if not language:
        return None

    metadata = None
    if isinstance(nested_front, dict) and isinstance(nested_front.get(language), dict):
        metadata = nested_front[language]
    elif isinstance(images.get(f"front_{language}"), dict):
        metadata = images[f"front_{language}"]
    if metadata is None:
        return None

    revision = metadata.get("rev")
    sizes = metadata.get("sizes")
    if revision is None or not isinstance(sizes, dict):
        return None
    revision_str = str(revision).strip()
    if not revision_str:
        return None

    size = next((s for s in _IMAGE_SIZE_PREFERENCE if isinstance(sizes.get(s), dict)), None)
    if not size:
        return None

    code = item.get("code")
    if not code:
        return None
    filename = f"front_{language}.{revision_str}.{size}.jpg"
    return f"https://images.openfoodfacts.org/images/products/{_barcode_folder(str(code))}/{filename}"


def to_iso_millis(dt):
    """Formatiert `dt` byte-identisch zu JS' `toISOString()` — siehe
    `extract_last_modified_at` fuer die Begruendung."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def extract_last_modified_at(item):
    """`last_modified_t` (Unix-Sekunden) in einen ISO-8601-Zeitstempel
    umwandeln, deckungsgleich mit dem TS-seitigen Parser (`new
    Date(t * 1000).toISOString()` in src/lib/open-food-facts.ts).

    Format muss BYTE-IDENTISCH zu JS' toISOString() sein (Millisekunden immer
    dreistellig, z.B. "...20.000Z") — sonst sortieren Live- (JS) und
    Dump-Werte (Python) fuer denselben Zeitpunkt lexikografisch
    unterschiedlich, und die "nur bei neuerem off_last_modified_at
    aktualisieren"-Logik der vertrauenswuerdigen Anreicherung (#223 Paket 10)
    faellt falsch aus.
    """
    raw = item.get("last_modified_t")
    if raw is None:
        return None
    try:
        seconds = float(raw)
        if seconds <= 0:
            return None
        return to_iso_millis(datetime.fromtimestamp(seconds, tz=timezone.utc))
    except (TypeError, ValueError, OSError, OverflowError):
        return None


def _format_bytes(num_bytes):
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


def _format_seconds(seconds):
    seconds = max(int(seconds), 0)
    return f"{seconds // 60}m{seconds % 60:02d}s"


def _download_progress_hook(start_time):
    """`reporthook` für `urlretrieve` — ohne das gibt es waehrend des
    ~12-13-GB-Downloads keinerlei Lebenszeichen im Terminal. Aktualisiert
    hoechstens 2x/Sekunde (sonst spammt das bei kleinen Blockgroessen)."""
    last_print_at = [0.0]

    def hook(block_num, block_size, total_size):
        now = time.time()
        downloaded = block_num * block_size
        if total_size > 0:
            downloaded = min(downloaded, total_size)

        is_done = total_size > 0 and downloaded >= total_size
        if now - last_print_at[0] < 0.5 and not is_done:
            return
        last_print_at[0] = now

        elapsed = max(now - start_time, 0.001)
        speed = downloaded / elapsed

        if total_size > 0:
            pct = downloaded / total_size * 100
            eta = (total_size - downloaded) / speed if speed > 0 else 0
            print(
                f"\rDownload: {pct:5.1f}%  {_format_bytes(downloaded)} / {_format_bytes(total_size)}"
                f"  ({_format_bytes(speed)}/s, ETA {_format_seconds(eta)})   ",
                end="",
                flush=True,
            )
        else:
            print(
                f"\rDownload: {_format_bytes(downloaded)} geladen ({_format_bytes(speed)}/s)   ",
                end="",
                flush=True,
            )

    return hook


MAX_DOWNLOAD_ATTEMPTS = 3


def _expected_content_length(url):
    """HEAD-Request fuer die erwartete Groesse — ohne echten Download.
    `urlopen` folgt dem 302-Redirect (static.openfoodfacts.org -> S3)
    automatisch. `None`, wenn der Server keine Content-Length liefert
    (dann bleibt nur die Gzip-Pruefung als Absicherung)."""
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req) as response:
            length = response.headers.get("Content-Length")
            return int(length) if length else None
    except (urllib.error.URLError, ValueError):
        return None


def download_dump():
    """Laedt den vollen OFF-Export mit expliziter Vollstaendigkeitspruefung.

    `urlretrieve()` allein reicht nicht: Es soll zwar bei einer zu kurzen
    Antwort `ContentTooShortError` werfen, tat das hier aber nicht — der
    erste Lauf brach bei 8,73 von 11,85 GB fehlerfrei "erfolgreich" ab und
    crashte erst zwei Minuten spaeter beim Parsen mit einem rohen
    `EOFError` ("Compressed file ended before the end-of-stream marker").
    Deshalb hier eine eigene, explizite Groessenpruefung nach dem Download
    (und beim Wiederverwenden einer schon vorhandenen Datei) statt uns auf
    urlretrieve()s interne Pruefung zu verlassen — mit automatischem Retry.
    """
    expected_size = _expected_content_length(OFF_DUMP_URL)

    if os.path.exists(LOCAL_GZ_FILE):
        actual_size = os.path.getsize(LOCAL_GZ_FILE)
        if expected_size is not None and actual_size != expected_size:
            print(
                f"Vorhandene Datei ist unvollstaendig ({_format_bytes(actual_size)} von "
                f"{_format_bytes(expected_size)}) — wird geloescht und neu geladen."
            )
            os.remove(LOCAL_GZ_FILE)
        else:
            print("Lokaler Dump bereits vorhanden, überspringe Download.")
            return

    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        print(
            f"Lade Open Food Facts Dump herunter (Versuch {attempt}/{MAX_DOWNLOAD_ATTEMPTS}, "
            "voller Export, ~12-13 GB komprimiert)..."
        )
        try:
            urllib.request.urlretrieve(
                OFF_DUMP_URL, LOCAL_GZ_FILE, reporthook=_download_progress_hook(time.time())
            )
        except Exception as err:
            print(f"\nDownload-Fehler: {err}")
            if os.path.exists(LOCAL_GZ_FILE):
                os.remove(LOCAL_GZ_FILE)
            continue

        actual_size = os.path.getsize(LOCAL_GZ_FILE)
        if expected_size is not None and actual_size != expected_size:
            print(
                f"\nDownload unvollstaendig: {_format_bytes(actual_size)} von "
                f"{_format_bytes(expected_size)} erhalten."
            )
            os.remove(LOCAL_GZ_FILE)
            continue

        print("\nDownload abgeschlossen und Größe verifiziert!")
        return

    raise RuntimeError(
        f"Download nach {MAX_DOWNLOAD_ATTEMPTS} Versuchen weiterhin unvollstaendig. Abbruch — "
        "bitte Netzverbindung pruefen und das Skript erneut starten."
    )


def quick_check(db_path):
    """`PRAGMA quick_check` vor Veröffentlichung (#223 Paket 4) — eine
    beschädigte Datei darf nie als Release-Asset landen."""
    conn = sqlite3.connect(db_path)
    try:
        result = conn.execute("PRAGMA quick_check;").fetchone()
        return result is not None and result[0] == "ok"
    finally:
        conn.close()


def process_and_create_sqlite():
    # Falls alte DB existiert, vorher löschen für sauberen Neuaufbau
    if os.path.exists(OUTPUT_DB):
        os.remove(OUTPUT_DB)

    print("Erstelle SQLite-Datenbank...")
    conn = sqlite3.connect(OUTPUT_DB)
    cursor = conn.cursor()

    # SQLite Performance-Pragmas
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA journal_mode = MEMORY;")

    # Tabellen anlegen (Indexe erstellen wir erst GANZ AM ENDE!)
    cursor.execute("""
        CREATE TABLE products (
            code TEXT PRIMARY KEY,
            product_name TEXT,
            brand TEXT,
            quantity TEXT,
            stores TEXT,
            nutriscore TEXT,
            categories_tags TEXT,
            off_last_modified_at TEXT,
            energy_kcal REAL,
            fat REAL,
            saturated_fat REAL,
            carbohydrates REAL,
            sugars REAL,
            proteins REAL,
            salt REAL,
            image_url TEXT
        );
    """)
    cursor.execute("""
        CREATE TABLE dump_meta (
            schema_version INTEGER NOT NULL,
            data_version TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            source_cursor TEXT
        );
    """)

    count = 0
    inserted = 0
    complete_nutrition = 0
    with_categories = 0
    batch = []

    print("Verarbeite Daten und filtere für Deutschland...")
    parse_start = time.time()
    total_gz_size = os.path.getsize(LOCAL_GZ_FILE)

    # Rohdatei selbst offen halten (statt gzip.open() direkt), damit wir per
    # raw_file.tell() wissen, wie viele komprimierte Bytes schon gelesen
    # wurden — daraus lässt sich ein echter Fortschritt (%) und eine ETA für
    # die Verarbeitungsphase schätzen (Kompressionsrate ist über den Stream
    # hinweg näherungsweise konstant, also ist der Bytes-Anteil ein guter
    # Näherungswert für den Zeilen-Anteil).
    try:
        with open(LOCAL_GZ_FILE, 'rb') as raw_file:
            with gzip.GzipFile(fileobj=raw_file) as gz:
                f = io.TextIOWrapper(gz, encoding='utf-8')
                for line in f:
                    count += 1
                    if count % 100000 == 0:
                        elapsed = time.time() - parse_start
                        rate = count / elapsed if elapsed > 0 else 0
                        bytes_read = raw_file.tell()
                        pct = bytes_read / total_gz_size * 100 if total_gz_size > 0 else 0
                        eta = (elapsed / pct * (100 - pct)) if pct > 0 else 0
                        print(
                            f"{count:>10,} Zeilen ({rate:,.0f}/s) — {pct:5.1f}% des Downloads verarbeitet"
                            f", {_format_seconds(elapsed)} verstrichen, ETA {_format_seconds(eta)}"
                            f" — {inserted:,} DE-Produkte gespeichert"
                        )

                    # 0. Billiger Vorfilter OHNE JSON-Parsing: taucht der Ländermarker
                    #    nicht mal als Roh-Substring in der Zeile auf, kann
                    #    countries_tags ihn erst recht nicht enthalten — die
                    #    allermeisten Zeilen (nicht-deutsche Produkte) werden so
                    #    verworfen, ohne je geparst zu werden. Reiner
                    #    Fast-Reject: ein (seltener) falscher Treffer landet
                    #    einfach normal im echten Check unten, keine
                    #    Korrektheitsauswirkung.
                    if GERMANY_MARKER not in line:
                        continue

                    try:
                        item = _json_backend.loads(line)
                    except ValueError:
                        continue

                    # 1. Länder-Filter: Nur Produkte, die in Deutschland verkauft werden
                    countries = item.get("countries_tags", [])
                    if TARGET_COUNTRY_TAG not in countries:
                        continue

                    # 2. Relevante Felder extrahieren
                    code = item.get("code")
                    if not code:
                        continue

                    # Produktname (bevorzugt Deutsch, sonst Standard)
                    product_name = item.get("product_name_de") or item.get("product_name") or ""
                    if not product_name.strip():
                        continue # Ohne Namen macht ein Eintrag auf der Einkaufsliste keinen Sinn

                    brand = item.get("brands", "")
                    quantity = item.get("quantity", "")

                    # Läden (Stores)
                    stores = item.get("stores", "")

                    # Nutriscore
                    nutriscore = item.get("nutriscore_grade", "").lower()

                    # OFF-Kategorie-Taxonomie (#223 Paket 4)
                    categories_tags_json = extract_category_tags(item)
                    off_last_modified_at = extract_last_modified_at(item)
                    if categories_tags_json != "[]":
                        with_categories += 1

                    # Nährwerte (per 100g/100ml), mit Fallback-Kette (siehe extract_nutrient)
                    energy_kcal = extract_nutrient(item, "energy-kcal")
                    fat = extract_nutrient(item, "fat")
                    saturated_fat = extract_nutrient(item, "saturated-fat")
                    carbohydrates = extract_nutrient(item, "carbohydrates")
                    sugars = extract_nutrient(item, "sugars")
                    proteins = extract_nutrient(item, "proteins")
                    salt = extract_nutrient(item, "salt")

                    if None not in (energy_kcal, proteins, carbohydrates, fat):
                        complete_nutrition += 1

                    image_url = extract_front_image_url(item)

                    batch.append((
                        str(code), product_name, brand, quantity, stores, nutriscore,
                        categories_tags_json, off_last_modified_at,
                        energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt,
                        image_url
                    ))

                    # In Tausender-Blöcken in SQLite schreiben (Batching für maximale Geschwindigkeit)
                    if len(batch) >= 5000:
                        cursor.executemany("""
                            INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, batch)
                        batch = []
                        inserted += 5000
                        # Zwischen-Commit statt nur ganz am Ende: bei einem Absturz
                        # (z.B. beschädigter Download, siehe except EOFError unten)
                        # geht so nur der letzte angefangene Batch verloren, nicht
                        # die komplette bisherige Arbeit.
                        conn.commit()

                # Restliche Daten schreiben
                if batch:
                    cursor.executemany("""
                        INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, batch)
                    inserted += len(batch)
                    conn.commit()
    # except EOFError as err:
    except (EOFError, gzip.BadGzipFile, OSError) as err:
        conn.commit()
        conn.close()
        print(
            f"\nFEHLER: Gzip-Datei ist beschädigt/unvollständig ({err}).\n"
            f"Bereits verarbeitete Produkte sind committet und in '{OUTPUT_DB}' vorhanden "
            f"({inserted:,} Stück) — aber die Datei ist unvollständig, NICHT verwenden.\n"
            f"Bitte '{LOCAL_GZ_FILE}' löschen und das Skript erneut starten "
            "(lädt den Export automatisch neu)."
        )
        sys.exit(1)

    generated_at = to_iso_millis(datetime.now(timezone.utc))
    cursor.execute(
        "INSERT INTO dump_meta (schema_version, data_version, generated_at, source_cursor) VALUES (?, ?, ?, ?)",
        (SCHEMA_VERSION, generated_at, generated_at, None),
    )
    conn.commit()

    # Indexe ERST JETZT erstellen (spart extrem viel Zeit!)
    print("Erstelle Indexe für die Suchfunktion...")
    cursor.execute("CREATE INDEX idx_product_name ON products(product_name);")
    cursor.execute("CREATE INDEX idx_brand ON products(brand);")
    conn.commit()
    conn.close()

    quote = (complete_nutrition / inserted * 100) if inserted else 0
    category_quote = (with_categories / inserted * 100) if inserted else 0
    print(f"FERTIG! Insgesamt {inserted} deutsche Produkte in '{OUTPUT_DB}' gespeichert (Schema {SCHEMA_VERSION}).")
    print(
        f"Davon mit vollstaendigen Kern-Naehrwerten (kcal/Protein/Kohlenhydrate/Fett): "
        f"{complete_nutrition} ({quote:.1f} %)."
    )
    print(f"Davon mit mindestens einem OFF-Kategorie-Tag: {with_categories} ({category_quote:.1f} %).")

    print("Prüfe Integrität (quick_check)...")
    if not quick_check(OUTPUT_DB):
        print("FEHLER: quick_check ist fehlgeschlagen — Datei wird NICHT veröffentlicht.")
        sys.exit(1)
    print("quick_check: ok.")


if __name__ == "__main__":
    print(f"JSON-Parser: {_JSON_BACKEND_NAME}")
    download_dump()
    process_and_create_sqlite()

    # Aufräumen: Temporären Dump nach der Verarbeitung löschen
    if os.path.exists(LOCAL_GZ_FILE):
        print("Lösche temporären Dump...")
        os.remove(LOCAL_GZ_FILE)
        print("Fertig! Speicherplatz ist wieder frei.")
