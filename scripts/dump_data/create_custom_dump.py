import gzip
import json
import sqlite3
import urllib.request
import os

# Konfiguration
OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
LOCAL_GZ_FILE = "off_dump.jsonl.gz"
OUTPUT_DB = "products_de.db"
TARGET_COUNTRY_TAG = "en:germany" # Für AT/CH einfach erweitern

def download_dump():
    if not os.path.exists(LOCAL_GZ_FILE):
        print("Lade Open Food Facts Dump herunter (kann ein paar Minuten dauern)...")
        urllib.request.urlretrieve(OFF_DUMP_URL, LOCAL_GZ_FILE)
        print("Download abgeschlossen!")
    else:
        print("Lokaler Dump bereits vorhanden, überspringe Download.")

def process_and_create_sqlite():
    print("Erstelle SQLite-Datenbank...")
    conn = sqlite3.connect(OUTPUT_DB)
    cursor = conn.cursor()

    # Tabelle & Indexe anlegen
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_name ON products(product_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_brand ON products(brand);")

    count = 0
    inserted = 0
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

            # Nährwerte (per 100g/100ml)
            nutriments = item.get("nutriments", {})
            energy_kcal = nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal")
            fat = nutriments.get("fat_100g")
            saturated_fat = nutriments.get("saturated-fat_100g")
            carbohydrates = nutriments.get("carbohydrates_100g")
            sugars = nutriments.get("sugars_100g")
            proteins = nutriments.get("proteins_100g")
            salt = nutriments.get("salt_100g")

            batch.append((
                str(code), product_name, brand, quantity, stores, nutriscore,
                energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
            ))

            # In Tausender-Blöcken in SQLite schreiben (Batching für maximale Geschwindigkeit)
            if len(batch) >= 1000:
                cursor.executemany("""
                    INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                batch = []
                inserted += 1000

        # Restliche Daten schreiben
        if batch:
            cursor.executemany("""
                INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            inserted += len(batch)

    conn.commit()
    conn.close()
    print(f"FERTIG! Insgesamt {inserted} deutsche Produkte in '{OUTPUT_DB}' gespeichert.")

if __name__ == "__main__":
    download_dump()
    process_and_create_sqlite()
    
    # Aufräumen: Temporären Dump nach der Verarbeitung löschen
    if os.path.exists(LOCAL_GZ_FILE):
        print("Lösche temporären Dump...")
        os.remove(LOCAL_GZ_FILE)
        print("Fertig! Speicherplatz ist wieder frei.")