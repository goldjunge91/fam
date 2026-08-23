import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
};

type DmSearchProduct = {
  gtin?: string;
  dan?: string;
  title?: string;
  brandName?: string;
  price?: {
    price?: {
      current?: {
        value?: number | string;
      };
    };
  };
  trackingData?: {
    categories?: string[];
  };
};

type DmSearchResponse = {
  count?: number;
  totalPages?: number;
  products?: DmSearchProduct[];
};

type CrawledProduct = {
  gtin: string | undefined;
  dan: string | undefined;
  title: string | undefined;
  brand: string | undefined;
  price: number | string;
  category: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function saveProgress(searchTerm: string, data: CrawledProduct[]) {
  const outDir = join(import.meta.dirname, 'data');
  await mkdir(outDir, { recursive: true });
  const safeFilename = searchTerm.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const outPath = join(outDir, `katalog_${safeFilename}.json`);
  await writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 (Zwischen-)Speicherung erfolgreich: ${outPath}`);
}

async function crawlCategory(searchTerm: string) {
  console.log(`🚀 Starte Crawler für den Suchbegriff/Kategorie: "${searchTerm}"`);

  const allProducts: CrawledProduct[] = [];
  let currentPage = 0;
  let totalPages = 1;

  try {
    while (currentPage < totalPages) {
      console.log(`⏳ Lade Seite ${currentPage + 1} von ${totalPages}...`);

      const searchUrl = `https://product-search.services.dmtech.com/de/search?query=${encodeURIComponent(searchTerm)}&searchProviderType=dm-products&searchType=search&type=search&pageSize=30&currentPage=${currentPage}`;

      const res = await fetch(searchUrl, { headers: API_HEADERS });

      if (res.status === 429) {
        console.warn('⚠️ Rate-Limit erreicht (429 Too Many Requests)! Pausiere für 15 Sekunden...');
        await saveProgress(searchTerm, allProducts);
        await sleep(15000);
        continue; // Versuche dieselbe Seite nochmal
      }

      if (!res.ok) {
        throw new Error(`API Fehler: ${res.status} ${res.statusText}`);
      }

      const data: DmSearchResponse = await res.json();

      if (currentPage === 0) {
        totalPages = data.totalPages || 1;
        console.log(`📊 Insgesamt ${data.count} Produkte auf ${totalPages} Seiten gefunden.`);
      }

      const products = data.products ?? [];
      if (products.length === 0) break;

      for (const p of products) {
        allProducts.push({
          gtin: p.gtin,
          dan: p.dan,
          title: p.title,
          brand: p.brandName,
          price: p.price?.price?.current?.value ?? 'N/A',
          category: p.trackingData?.categories ?? [],
        });
      }

      currentPage++;

      // Lange Pause, um die Firewall nicht auszulösen (3 bis 5 Sekunden)
      if (currentPage < totalPages) {
        const randomSleep = 3000 + Math.random() * 2000;
        console.log(`😴 Warte ${Math.round(randomSleep)}ms...`);
        await sleep(randomSleep);
      }
    }

    await saveProgress(searchTerm, allProducts);
    console.log(`🎉 Fertig! ${allProducts.length} Produkte vollständig gesammelt.`);
  } catch (error) {
    console.error('💥 Ein Fehler ist aufgetreten:', error);
    // Rette die Daten, die wir bisher gesammelt haben!
    if (allProducts.length > 0) {
      console.log('Rette gesammelte Daten vor dem Absturz...');
      await saveProgress(searchTerm, allProducts);
    }
  }
}

const args = process.argv.slice(2);
const searchTerm = args.join(' ');

if (!searchTerm) {
  console.log('Bitte gib einen Suchbegriff oder eine Kategorie an.');
  console.log('Beispiel: bun run tools/crawl-dm-category.ts Babybrei');
  process.exit(1);
}

crawlCategory(searchTerm);
