CREATE TABLE products (
    code TEXT PRIMARY KEY,          -- EAN / Barcode
    product_name TEXT,             -- Produktname
    brand TEXT,                    -- Marke
    quantity TEXT,                 -- Menge (z. B. "500g" oder "1,5 Litern")
    stores TEXT,                   -- Läden (z. B. "REWE, Edeka")
    nutriscore TEXT,               -- Nutri-Score (a, b, c, d, e)
    
    -- Nährwerte pro 100g / 100ml
    energy_kcal REAL,              -- Kalorien (kcal)
    fat REAL,                      -- Fett (g)
    saturated_fat REAL,            -- Gesättigte Fettsäuren (g)
    carbohydrates REAL,            -- Kohlenhydrate (g)
    sugars REAL,                   -- Zucker (g)
    proteins REAL,                 -- Eiweiß (g)
    salt REAL                      -- Salz (g)
);

-- Indexe für extrem schnelle Suchen in iOS/Android
CREATE INDEX idx_product_name ON products(product_name);
CREATE INDEX idx_brand ON products(brand);