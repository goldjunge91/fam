import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
};

type DmSearchProduct = {
  dan?: string;
  title?: string;
  [key: string]: unknown;
};

type DmSearchResponse = {
  products?: DmSearchProduct[];
};

async function fetchDmProduct(gtin: string) {
  console.log(`🔍 Starte Suche für GTIN/Barcode: ${gtin}`);

  try {
    // Schritt 1: Produktsuche nach GTIN, um die interne DAN zu bekommen
    const searchUrl = `https://product-search.services.dmtech.com/de/search?query=${gtin}&searchProviderType=dm-products`;
    const searchRes = await fetch(searchUrl, { headers: API_HEADERS });

    if (!searchRes.ok) {
      throw new Error(`Search API Fehler: ${searchRes.status} ${searchRes.statusText}`);
    }

    const searchData: DmSearchResponse = await searchRes.json();
    const products = searchData.products ?? [];

    if (products.length === 0) {
      console.log(`❌ Kein Produkt für GTIN ${gtin} gefunden.`);
      return;
    }

    // Wir nehmen den ersten Treffer
    const productBase = products[0];
    const dan = productBase.dan;
    const title = productBase.title;

    console.log(`✅ Gefunden: ${title} (DAN: ${dan})`);
    console.log('⬇️ Lade detaillierte Produktdaten herunter...');

    // Schritt 2: Detail-API mit der DAN abfragen
    const detailUrl = `https://products.dm.de/product/products/detail/DE/dan/${dan}`;
    const detailRes = await fetch(detailUrl, { headers: API_HEADERS });

    if (!detailRes.ok) {
      throw new Error(`Detail API Fehler: ${detailRes.status} ${detailRes.statusText}`);
    }

    // Struktur der Detail-API ist nicht dokumentiert, daher unknown statt any —
    // wir speichern sie unangetastet weg, ohne auf Felder zuzugreifen.
    const detailData: unknown = await detailRes.json();

    // Zusammenführen: Wir speichern Suchergebnis + Detaildaten in eine Datei
    const combinedData = {
      _meta: {
        fetchedAt: new Date().toISOString(),
        gtin,
        dan,
        source: 'dm.de',
      },
      searchData: productBase,
      detailedData: detailData,
    };

    // Ordner sicherstellen
    const outDir = join(import.meta.dirname, 'data');
    await mkdir(outDir, { recursive: true });

    // Datei schreiben
    const filename = `product_${gtin}_${dan}.json`;
    const outPath = join(outDir, filename);

    await writeFile(outPath, JSON.stringify(combinedData, null, 2), 'utf-8');

    console.log(`🎉 Erfolgreich gespeichert unter: tools/data/${filename}`);
  } catch (error) {
    console.error('💥 Ein Fehler ist aufgetreten:', error);
  }
}

// Skript ausführen
const args = process.argv.slice(2);
const gtinArg = args[0];

if (!gtinArg) {
  console.log('Bitte gib einen Barcode (GTIN) an.');
  console.log('Beispiel: bun run tools/fetch-dm-product.ts 4066447208320');
  process.exit(1);
}

fetchDmProduct(gtinArg);
