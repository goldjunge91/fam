export type ProductDetails = {
  name: string;
  brand: string;
  category: string;
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E';
  kcal: number;
  unitReference: string;
  icon: string;
  macros: {
    proteinG: number;
    carbsG: number;
    sugarG: number;
    fatG: number;
    satFatG: number;
    saltG: number;
  };
  ingredients: string;
  allergens: string[];
};

const PRODUCT_CATALOG: Record<string, Partial<ProductDetails>> = {
  vollmilch: {
    name: 'Vollmilch',
    brand: 'Landliebe',
    category: 'Milchprodukte',
    nutriScore: 'B',
    kcal: 64,
    unitReference: 'pro 100 ml',
    icon: '🥛',
    macros: {
      proteinG: 3.3,
      carbsG: 4.8,
      sugarG: 4.8,
      fatG: 3.5,
      satFatG: 2.3,
      saltG: 0.1,
    },
    ingredients: 'Vollmilch, pasteurisiert und homogenisiert.',
    allergens: ['Milch'],
  },
  milch: {
    name: 'Frische Vollmilch',
    brand: 'Bärenmarke',
    category: 'Milchprodukte',
    nutriScore: 'B',
    kcal: 64,
    unitReference: 'pro 100 ml',
    icon: '🥛',
    macros: {
      proteinG: 3.4,
      carbsG: 4.9,
      sugarG: 4.9,
      fatG: 3.8,
      satFatG: 2.5,
      saltG: 0.11,
    },
    ingredients: 'Kuhmilch mit 3,8% Fett.',
    allergens: ['Milch'],
  },
  'bio-spinat': {
    name: 'Bio-Spinat',
    brand: 'Iglo',
    category: 'Gemüse',
    nutriScore: 'A',
    kcal: 23,
    unitReference: 'pro 100 g',
    icon: '🥬',
    macros: {
      proteinG: 2.9,
      carbsG: 0.8,
      sugarG: 0.4,
      fatG: 0.4,
      satFatG: 0.1,
      saltG: 0.05,
    },
    ingredients: 'Bio-Blattspinat aus kontrolliert biologischem Anbau.',
    allergens: [],
  },
  spinat: {
    name: 'Blattspinat',
    brand: 'Frosta',
    category: 'Gemüse',
    nutriScore: 'A',
    kcal: 23,
    unitReference: 'pro 100 g',
    icon: '🥬',
    macros: {
      proteinG: 2.9,
      carbsG: 0.8,
      sugarG: 0.4,
      fatG: 0.4,
      satFatG: 0.1,
      saltG: 0.05,
    },
    ingredients: 'Blattspinat, tiefgefroren.',
    allergens: [],
  },
  'griechischer joghurt': {
    name: 'Griechischer Joghurt',
    brand: 'Kolios',
    category: 'Milchprodukte',
    nutriScore: 'B',
    kcal: 115,
    unitReference: 'pro 100 g',
    icon: '🥣',
    macros: {
      proteinG: 6.5,
      carbsG: 4.0,
      sugarG: 4.0,
      fatG: 10.0,
      satFatG: 7.0,
      saltG: 0.12,
    },
    ingredients: 'Pasteurisierte Kuhmilch, Sahne, Joghurtkulturen.',
    allergens: ['Milch'],
  },
  hähnchenbrust: {
    name: 'Hähnchenbrust',
    brand: 'Wiesenhof',
    category: 'Fleisch',
    nutriScore: 'A',
    kcal: 106,
    unitReference: 'pro 100 g',
    icon: '🍗',
    macros: {
      proteinG: 23.0,
      carbsG: 0.0,
      sugarG: 0.0,
      fatG: 1.5,
      satFatG: 0.4,
      saltG: 0.15,
    },
    ingredients: '100% Hähnchenbrustfilet.',
    allergens: [],
  },
  gouda: {
    name: 'Gouda',
    brand: 'Guten Land',
    category: 'Milchprodukte',
    nutriScore: 'D',
    kcal: 350,
    unitReference: 'pro 100 g',
    icon: '🧀',
    macros: {
      proteinG: 25.0,
      carbsG: 0.0,
      sugarG: 0.0,
      fatG: 28.0,
      satFatG: 18.5,
      saltG: 1.8,
    },
    ingredients: 'Pasteurisierte Kuhmilch, Salz, Käsereikulturen, Lab.',
    allergens: ['Milch'],
  },
  'orangen-saft': {
    name: 'Orangen-Saft',
    brand: 'Innocent',
    category: 'Getränke',
    nutriScore: 'C',
    kcal: 43,
    unitReference: 'pro 100 ml',
    icon: '🍊',
    macros: {
      proteinG: 0.7,
      carbsG: 9.0,
      sugarG: 9.0,
      fatG: 0.2,
      satFatG: 0.0,
      saltG: 0.01,
    },
    ingredients: '100% gepresster Orangensaft aus Fruchtsaftkonzentrat.',
    allergens: [],
  },
};

export function getProductDetails(name: string): ProductDetails {
  const normalized = name.toLowerCase().trim();

  for (const [key, details] of Object.entries(PRODUCT_CATALOG)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        name: details.name || name,
        brand: details.brand || 'Hausmarke',
        category: details.category || 'Vorrat',
        nutriScore: details.nutriScore || 'B',
        kcal: details.kcal || 85,
        unitReference: details.unitReference || 'pro 100 g',
        icon: details.icon || '📦',
        macros: details.macros || {
          proteinG: 4.2,
          carbsG: 12.0,
          sugarG: 5.5,
          fatG: 2.1,
          satFatG: 0.8,
          saltG: 0.2,
        },
        ingredients: details.ingredients || `${name}, natürliche Zutaten.`,
        allergens: details.allergens || [],
      };
    }
  }

  // Fallback defaults for custom products
  return {
    name,
    brand: 'Hausmarke',
    category: 'Vorrat',
    nutriScore: 'B',
    kcal: 75,
    unitReference: 'pro 100 g',
    icon: '📦',
    macros: {
      proteinG: 5.0,
      carbsG: 10.0,
      sugarG: 4.0,
      fatG: 2.0,
      satFatG: 0.5,
      saltG: 0.1,
    },
    ingredients: `${name}, frische Zutat.`,
    allergens: [],
  };
}
