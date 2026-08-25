export interface LocalBrochureStore {
  id: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
  isFavorite?: boolean; // Angereichert durch JOIN mit favorite_brochure_stores
}

export interface LocalBrochure {
  id: string;
  storeId: string;
  title: string;
  validFrom: string;
  validUntil: string;
  coverImage: string;
}

export interface Hotspot {
  id: string;
  x: number; // Percentage (z.B. 10 für 10%)
  y: number; // Percentage
  width: number;
  height: number;
  title: string;
  description?: string;
  discount?: string;
  priceCents?: number;
  oldPriceCents?: number;
  currency?: string;
  imageUrl?: string;
}

export interface LocalBrochurePage {
  id: string;
  brochureId: string;
  pageNumber: number;
  imageUrl: string;
  hotspots: Hotspot[]; // Aus hotspots_json geparst
}
