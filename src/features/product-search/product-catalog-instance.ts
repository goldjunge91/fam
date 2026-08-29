import {
  createProductCatalog,
  type ProductCatalog,
} from '@/features/product-search/product-catalog';
import { createLocalProductSource } from '@/features/product-search/sources/local-product-source';
import { createOffApiSource } from '@/features/product-search/sources/off-api-source';
import { createOffDumpProductSource } from '@/features/product-search/sources/off-dump-product-source';

/**
 * Die Katalog-Instanz der App: der einzige Ort, an dem die echten Quellen
 * verdrahtet werden. Tests bauen sich stattdessen einen eigenen Katalog mit
 * Fake-Quellen bzw. reichen einen Fake-Katalog in die Hooks.
 */
export const productCatalog: ProductCatalog = createProductCatalog({
  local: createLocalProductSource(),
  dump: createOffDumpProductSource(),
  api: createOffApiSource(),
});
