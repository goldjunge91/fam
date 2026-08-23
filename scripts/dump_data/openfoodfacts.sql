-- Schema 2 (#223 Paket 4) — alte Schema-1-Dumps werden gelöscht, nicht
-- migriert (siehe `create_custom_dump.py`, `dump_meta.schema_version`).
CREATE TABLE products (
    code TEXT PRIMARY KEY,          -- EAN / Barcode
    product_name TEXT,             -- Produktname
    brand TEXT,                    -- Marke
    quantity TEXT,                 -- Menge (z. B. "500g" oder "1,5 Litern")
    stores TEXT,                   -- Läden (z. B. "REWE, Edeka")
    nutriscore TEXT,               -- Nutri-Score (a, b, c, d, e)

    -- Kanonische Open-Food-Facts-`categories_tags` als JSON-Array-Text
    -- (SQLite kennt kein natives text[]) — dieselbe Eingabe wie der
    -- Klassifikator sie aus der Live-Suche bekommt, siehe
    -- src/features/shopping-list/classification/.
    categories_tags TEXT,           -- z.B. '["en:meats","en:porks"]'
    off_last_modified_at TEXT,      -- ISO-8601, aus OFFs last_modified_t (Unix-Sekunden)

    -- Nährwerte pro 100g / 100ml
    energy_kcal REAL,              -- Kalorien (kcal)
    fat REAL,                      -- Fett (g)
    saturated_fat REAL,            -- Gesättigte Fettsäuren (g)
    carbohydrates REAL,            -- Kohlenhydrate (g)
    sugars REAL,                   -- Zucker (g)
    proteins REAL,                 -- Eiweiß (g)
    salt REAL                      -- Salz (g)
);

-- Metadaten der Dump-Erzeugung (#223 Paket 4/5) — `source_cursor` bleibt bei
-- einer vollen Baseline NULL und wird erst mit der Delta-Pipeline (Paket 5)
-- gesetzt.
CREATE TABLE dump_meta (
    schema_version INTEGER NOT NULL,
    data_version TEXT NOT NULL,     -- ISO-8601-Erzeugungszeitstempel dieser Baseline
    generated_at TEXT NOT NULL,     -- ISO-8601
    source_cursor TEXT              -- NULL bei einer vollen Baseline
);

-- Indexe für extrem schnelle Suchen in iOS/Android
CREATE INDEX idx_product_name ON products(product_name);
CREATE INDEX idx_brand ON products(brand);