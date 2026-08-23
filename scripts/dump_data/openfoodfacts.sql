-- Schema 2 (#223 Paket 4) — alte Schema-1-Dumps werden gelöscht, nicht
-- migriert (siehe `create_custom_dump.py`, `dump_meta.schema_version`).
CREATE TABLE products (
    code TEXT PRIMARY KEY,
    product_name TEXT,
    brand TEXT,
    quantity TEXT,
    stores TEXT,
    nutriscore TEXT,

    -- SQLite speichert OFF-categories_tags als JSON-Array-Text.
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

-- source_cursor bleibt fuer volle Baselines NULL und gehoert der Delta-Pipeline.
CREATE TABLE dump_meta (
    schema_version INTEGER NOT NULL,
    data_version TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    source_cursor TEXT
);

CREATE INDEX idx_product_name ON products(product_name);
CREATE INDEX idx_brand ON products(brand);
