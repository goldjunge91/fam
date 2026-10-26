import { useQuery } from '@tanstack/react-query';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog } from '@/lib/observability/debug-log';
import {
  type BrochureImagePrefetchReference,
  MAX_BROCHURE_PREFETCH_IMAGES,
} from '../lib/brochure-image-prefetch';
import type { LocalBrochure, LocalBrochurePage, LocalBrochureStore } from '../types';

export function useBrochures() {
  return useQuery({
    queryKey: ['brochures', 'overview'],
    queryFn: async () => {
      const db = await getDatabase();
      const cache = await db.getFirstAsync<{ zip_code: string }>(
        'SELECT zip_code FROM local_brochure_cache WHERE id = 1',
      );

      // 1. Hole alle Stores und reiche "isFavorite" an
      const storesQuery = `
        SELECT 
          s.id, s.name, s.logo_url as logoUrl, s.active,
          CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as isFavorite
        FROM local_brochure_stores s
        LEFT JOIN favorite_brochure_stores f ON f.store_id = s.id AND f.deleted_at IS NULL
      `;
      const stores = await db.getAllAsync<{
        id: string;
        name: string;
        logoUrl: string | null;
        active: number;
        isFavorite: number;
      }>(storesQuery);

      const mappedStores: LocalBrochureStore[] = stores.map(
        (s: {
          id: string;
          name: string;
          logoUrl: string | null;
          active: number;
          isFavorite: number;
        }) => ({
          id: s.id,
          name: s.name,
          logoUrl: s.logoUrl,
          active: s.active === 1,
          isFavorite: s.isFavorite === 1,
        }),
      );

      // 2. Hole aktuelle Prospekte
      const brochures = await db.getAllAsync<{
        id: string;
        store_id: string;
        title: string;
        valid_from: string;
        valid_until: string;
        cover_image: string;
      }>('SELECT * FROM local_brochures ORDER BY valid_until ASC');

      const mappedBrochures: LocalBrochure[] = brochures.map(
        (b: {
          id: string;
          store_id: string;
          title: string;
          valid_from: string;
          valid_until: string;
          cover_image: string;
        }) => ({
          id: b.id,
          storeId: b.store_id,
          title: b.title,
          validFrom: b.valid_from,
          validUntil: b.valid_until,
          coverImage: b.cover_image,
        }),
      );

      const now = Date.now();
      const activeBrochures = mappedBrochures.filter(
        (brochure) => Date.parse(brochure.validUntil) > now,
      );
      const activeStoreIds = new Set(activeBrochures.map((brochure) => brochure.storeId));
      const pageRows = await db.getAllAsync<{
        brochure_id: string;
        page_number: number;
        image_url: string;
        valid_until: string;
      }>(
        `SELECT p.brochure_id, p.page_number, p.image_url, b.valid_until
         FROM local_brochure_pages p
         JOIN local_brochures b ON b.id = p.brochure_id
         WHERE p.page_number >= 1 AND b.valid_until > ?
         ORDER BY b.valid_until ASC, b.id ASC, p.page_number ASC`,
        [new Date(now).toISOString()],
      );
      const imageReferences: BrochureImagePrefetchReference[] = [
        ...activeBrochures.map((brochure) => ({
          uri: brochure.coverImage,
          validUntil: brochure.validUntil,
        })),
        ...pageRows.map((page) => ({
          uri: page.image_url,
          validUntil: page.valid_until,
        })),
      ].slice(0, MAX_BROCHURE_PREFETCH_IMAGES);

      return {
        cacheZip: cache?.zip_code ?? null,
        stores: mappedStores,
        brochures: activeBrochures,
        favorites: mappedStores.filter((store) => store.isFavorite && activeStoreIds.has(store.id)),
        imageReferences,
      };
    },
  });
}

export function useBrochurePages(brochureId: string) {
  return useQuery({
    queryKey: ['brochures', 'pages', brochureId],
    queryFn: async () => {
      const db = await getDatabase();
      const pages = await db.getAllAsync<{
        id: string;
        brochure_id: string;
        store_name: string;
        page_number: number;
        image_url: string;
        hotspots_json: string;
      }>(
        `SELECT p.*, s.name AS store_name
         FROM local_brochure_pages p
         JOIN local_brochures b ON b.id = p.brochure_id
         JOIN local_brochure_stores s ON s.id = b.store_id
         WHERE p.brochure_id = ?
         ORDER BY p.page_number ASC`,
        [brochureId],
      );

      const mappedPages = pages.map(
        (p: {
          id: string;
          brochure_id: string;
          store_name: string;
          page_number: number;
          image_url: string;
          hotspots_json: string;
        }): LocalBrochurePage => ({
          id: p.id,
          brochureId: p.brochure_id,
          storeName: p.store_name,
          pageNumber: p.page_number,
          imageUrl: p.image_url,
          hotspots: JSON.parse(p.hotspots_json),
        }),
      );

      debugLog('[brochures] local pages loaded', {
        brochureId,
        pageCount: mappedPages.length,
        hotspotCount: mappedPages.reduce((total, page) => total + page.hotspots.length, 0),
        pagesWithHotspots: mappedPages.filter((page) => page.hotspots.length > 0).length,
        firstPage: mappedPages[0]
          ? {
              pageNumber: mappedPages[0].pageNumber,
              hotspotCount: mappedPages[0].hotspots.length,
            }
          : null,
      });

      return mappedPages;
    },
    enabled: !!brochureId,
  });
}
