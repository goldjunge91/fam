# Product Search Lab

Bewertet die geplante Artikelsuche gegen den vollständigen lokalen Open-Food-Facts-Dump. Das Tool ist absichtlich außerhalb des produktiven App-Codes und darf experimentell bleiben.

```bash
bun tools/product-search-lab/server.ts
# danach die vom Server ausgegebene http://localhost-Adresse öffnen
# Standard: http://localhost:8765

bun tools/product-search-lab/search.ts "1l coca ccola"
bun tools/product-search-lab/search.ts "haferflocken kernig" --market rewe
bun tools/product-search-lab/search.ts "cola" --compare --limit 20
bun tools/product-search-lab/search.ts "cola" --json > /tmp/cola-search.json
```

Standard-Dump: `scripts/dump_data/products_de.db`.

Der aktuelle Prototyp prüft jedes Produkt im Dump und zeigt die Ranking-Signale pro Treffer. Die Eigenmarken-Liste ist bewusst eine testbare Hypothese und noch keine Produktentscheidung.
