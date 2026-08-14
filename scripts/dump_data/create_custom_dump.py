import gzip
import json
import sqlite3
import urllib.request
import os

# Dynamische Pfade: Speichert alles immer im selben Ordner wie das Skript selbst
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_GZ_FILE = os.path.join(SCRIPT_DIR, "off_dump.jsonl.gz")
OUTPUT_DB = os.path.join(SCRIPT_DIR, "products_de.db")

OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
TARGET_COUNTRY_TAG = "en:germany"


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


def download_dump():
    if not os.path.exists(LOCAL_GZ_FILE):
        print("Lade Open Food Facts Dump herunter (kann ein paar Minuten dauern)...")
        urllib.request.urlretrieve(OFF_DUMP_URL, LOCAL_GZ_FILE)
        print("Download abgeschlossen!")
    else:
        print("Lokaler Dump bereits vorhanden, überspringe Download.")

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

    # Tabelle anlegen (Indexe erstellen wir erst GANZ AM ENDE!)
    cursor.execute("""
        CREATE TABLE products (
            code TEXT PRIMARY KEY,
            product_name TEXT,
            brand TEXT,
            quantity TEXT,
            stores TEXT,
            nutriscore TEXT,
            energy_kcal REAL,
            fat REAL,
            saturated_fat REAL,
            carbohydrates REAL,
            sugars REAL,
            proteins REAL,
            salt REAL
        );
    """)

    count = 0
    inserted = 0
    complete_nutrition = 0
    batch = []

    print("Verarbeite Daten und filtere für Deutschland...")
    
    # Stream-Verarbeitung zeilenweise
    with gzip.open(LOCAL_GZ_FILE, 'rt', encoding='utf-8') as f:
        for line in f:
            count += 1
            if count % 100000 == 0:
                print(f"{count} Zeilen geparst... ({inserted} Produkte gespeichert)")

            try:
                item = json.loads(line)
            except json.JSONDecodeError:
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

            batch.append((
                str(code), product_name, brand, quantity, stores, nutriscore,
                energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
            ))

            # In Tausender-Blöcken in SQLite schreiben (Batching für maximale Geschwindigkeit)
            if len(batch) >= 5000:
                cursor.executemany("""
                    INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                batch = []
                inserted += 5000

        # Restliche Daten schreiben
        if batch:
            cursor.executemany("""
                INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            inserted += len(batch)

    conn.commit()

    # Indexe ERST JETZT erstellen (spart extrem viel Zeit!)
    print("Erstelle Indexe für die Suchfunktion...")
    cursor.execute("CREATE INDEX idx_product_name ON products(product_name);")
    cursor.execute("CREATE INDEX idx_brand ON products(brand);")
    conn.commit()

    conn.close()

    quote = (complete_nutrition / inserted * 100) if inserted else 0
    print(f"FERTIG! Insgesamt {inserted} deutsche Produkte in '{OUTPUT_DB}' gespeichert.")
    print(
        f"Davon mit vollstaendigen Kern-Naehrwerten (kcal/Protein/Kohlenhydrate/Fett): "
        f"{complete_nutrition} ({quote:.1f} %)."
    )

if __name__ == "__main__":
    download_dump()
    process_and_create_sqlite()
    
    # Aufräumen: Temporären Dump nach der Verarbeitung löschen
    if os.path.exists(LOCAL_GZ_FILE):
        print("Lösche temporären Dump...")
        os.remove(LOCAL_GZ_FILE)
        print("Fertig! Speicherplatz ist wieder frei.")