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

# DUMP_DATA_DIR kann den großen Export auf eine externe Platte legen.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DUMP_DATA_DIR", SCRIPT_DIR)
LOCAL_GZ_FILE = os.path.join(DATA_DIR, "off_dump.jsonl.gz")
OUTPUT_DB = os.path.join(DATA_DIR, "products_de.db")

# orjson beschleunigt den Export; json bleibt der kompatible Fallback.
try:
    import orjson as _json_backend
    _JSON_BACKEND_NAME = "orjson"
except ImportError:
    _json_backend = json
    _JSON_BACKEND_NAME = "json (Standardbibliothek — 'pip install orjson' fuer 2-5x schnelleres Parsen)"

OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
TARGET_COUNTRY_TAG = "en:germany"
# Rohmarker für den günstigen Vorfilter vor dem JSON-Parsing.
GERMANY_MARKER = f'"{TARGET_COUNTRY_TAG}"'

SCHEMA_VERSION = 2


def extract_nutrient(item, key):
    """Liest 100-g-Werte direkt, implizit oder aus Portionswerten hochgerechnet."""
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

    # OFF liefert Energie häufig nur in kJ.
    if key == "energy-kcal":
        kj = extract_nutrient(item, "energy")
        if kj is not None:
            return kj / 4.184

    return None


def extract_category_tags(item):
    """Serialisiert nur gültige kanonische Kategorien als JSON-Array."""
    raw_tags = item.get("categories_tags") or []
    tags = [tag for tag in raw_tags if isinstance(tag, str)]
    return json.dumps(tags)


def to_iso_millis(dt):
    """Formatiert Zeitstempel byte-identisch zu JS `toISOString()`."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def extract_last_modified_at(item):
    """Konvertiert OFF-Zeitstempel in lexikografisch vergleichbares ISO-Format."""
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
    """Begrenzt die Download-Fortschrittsanzeige auf zwei Updates pro Sekunde."""
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
    """Liest die erwartete Dateigröße, sofern der Server sie liefert."""
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req) as response:
            length = response.headers.get("Content-Length")
            return int(length) if length else None
    except (urllib.error.URLError, ValueError):
        return None


def download_dump():
    """Lädt den Export mit eigener Größenprüfung und Wiederholungsversuchen."""
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
    """Prüft die SQLite-Datei vor der Veröffentlichung."""
    conn = sqlite3.connect(db_path)
    try:
        result = conn.execute("PRAGMA quick_check;").fetchone()
        return result is not None and result[0] == "ok"
    finally:
        conn.close()


def process_and_create_sqlite():
    if os.path.exists(OUTPUT_DB):
        os.remove(OUTPUT_DB)

    print("Erstelle SQLite-Datenbank...")
    conn = sqlite3.connect(OUTPUT_DB)
    cursor = conn.cursor()

    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA journal_mode = MEMORY;")

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
            salt REAL
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

    # Der komprimierte Lesefortschritt dient als ETA-Näherung.
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

                    # Verwirft offensichtliche Nicht-DE-Zeilen vor dem JSON-Parsing.
                    if GERMANY_MARKER not in line:
                        continue

                    try:
                        item = _json_backend.loads(line)
                    except ValueError:
                        continue

                    countries = item.get("countries_tags", [])
                    if TARGET_COUNTRY_TAG not in countries:
                        continue

                    code = item.get("code")
                    if not code:
                        continue

                    product_name = item.get("product_name_de") or item.get("product_name") or ""
                    if not product_name.strip():
                        continue

                    brand = item.get("brands", "")
                    quantity = item.get("quantity", "")

                    stores = item.get("stores", "")

                    nutriscore = item.get("nutriscore_grade", "").lower()

                    categories_tags_json = extract_category_tags(item)
                    off_last_modified_at = extract_last_modified_at(item)
                    if categories_tags_json != "[]":
                        with_categories += 1

                    energy_kcal = extract_nutrient(item, "energy-kcal")
                    fat = extract_nutrient(item, "fat")
                    saturated_fat = extract_nutrient(item, "saturated-fat")
                    carbohydrates = extract_nutrient(item, "carbohydrates")
                    sugars = extract_nutrient(item, "sugars")
                    proteins = extract_nutrient(item, "proteins")
                    salt = extract_nutrient(item, "salt")

                    if None not in (energy_kcal, proteins, carbohydrates, fat):
                        complete_nutrition += 1

                    batch.append((
                        str(code), product_name, brand, quantity, stores, nutriscore,
                        categories_tags_json, off_last_modified_at,
                        energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
                    ))

                    if len(batch) >= 5000:
                        cursor.executemany("""
                            INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, batch)
                        batch = []
                        inserted += 5000
                        # Begrenzt den Datenverlust bei einem beschädigten Download.
                        conn.commit()

                if batch:
                    cursor.executemany("""
                        INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, batch)
                    inserted += len(batch)
                    conn.commit()
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

    # Indexe nach dem Import vermeiden laufende Aktualisierungskosten.
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

    if os.path.exists(LOCAL_GZ_FILE):
        print("Lösche temporären Dump...")
        os.remove(LOCAL_GZ_FILE)
        print("Fertig! Speicherplatz ist wieder frei.")
