import type { ImageSourcePropType } from 'react-native';

/**
 * Gebuendelte Titelbilder fuer die kuratierte Vorlagen-Bibliothek
 * (`assets/rezepte/*.jpg`), referenziert ueber einen stabilen Slug. `require()`
 * mit statischem Pfad ist zwingend, weil Metro keine dynamischen Asset-Pfade
 * aufloesen kann.
 */
const TEMPLATE_COVER_IMAGES: Record<string, ImageSourcePropType> = {
  'apfel-crumble': require('@/assets/rezepte/apfel-crumble.jpg'),
  'bananen-porridge': require('@/assets/rezepte/bananen-porridge.jpg'),
  bananenbrot: require('@/assets/rezepte/bananenbrot.jpg'),
  'brunch-eierspeise-mit-gouda-und-paprika': require('@/assets/rezepte/brunch-eierspeise-mit-gouda-und-paprika.jpg'),
  'chili-con-carne': require('@/assets/rezepte/chili-con-carne.jpg'),
  'couscous-salat-mit-kichererbsen': require('@/assets/rezepte/couscous-salat-mit-kichererbsen.jpg'),
  'frischkaese-dip-mit-paprika': require('@/assets/rezepte/frischkaese-dip-mit-paprika.jpg'),
  'gemuese-reispfanne': require('@/assets/rezepte/gemuese-reispfanne.jpg'),
  'geroestete-kichererbsen': require('@/assets/rezepte/geroestete-kichererbsen.jpg'),
  'haehnchen-gemuese-pfanne-mit-reis': require('@/assets/rezepte/haehnchen-gemuese-pfanne-mit-reis.jpg'),
  'haehnchen-schnitzel-mit-kartoffeln': require('@/assets/rezepte/haehnchen-schnitzel-mit-kartoffeln.jpg'),
  'haferflocken-honig-riegel': require('@/assets/rezepte/haferflocken-honig-riegel.jpg'),
  'honig-joghurt-mit-haferflocken': require('@/assets/rezepte/honig-joghurt-mit-haferflocken.jpg'),
  'joghurt-mit-apfel-und-honig': require('@/assets/rezepte/joghurt-mit-apfel-und-honig.jpg'),
  'kaese-kartoffel-auflauf': require('@/assets/rezepte/kaese-kartoffel-auflauf.jpg'),
  'kartoffel-gulasch': require('@/assets/rezepte/kartoffel-gulasch.jpg'),
  'kichererbsen-curry': require('@/assets/rezepte/kichererbsen-curry.jpg'),
  'kichererbsen-karotten-pfanne-mit-reis': require('@/assets/rezepte/kichererbsen-karotten-pfanne-mit-reis.jpg'),
  'klassische-pfannkuchen': require('@/assets/rezepte/klassische-pfannkuchen.jpg'),
  'linsen-eintopf': require('@/assets/rezepte/linsen-eintopf.jpg'),
  'linsensuppe-mit-karotten': require('@/assets/rezepte/linsensuppe-mit-karotten.jpg'),
  'overnight-oats-mit-banane-und-honig': require('@/assets/rezepte/overnight-oats-mit-banane-und-honig.jpg'),
  'ruehrei-mit-gouda': require('@/assets/rezepte/ruehrei-mit-gouda.jpg'),
  'schoko-pfannkuchen': require('@/assets/rezepte/schoko-pfannkuchen.jpg'),
  schokoladenkuchen: require('@/assets/rezepte/schokoladenkuchen.jpg'),
  'spaghetti-bolognese': require('@/assets/rezepte/spaghetti-bolognese.jpg'),
  'thunfisch-couscous-salat': require('@/assets/rezepte/thunfisch-couscous-salat.jpg'),
  'thunfisch-reis-salat': require('@/assets/rezepte/thunfisch-reis-salat.jpg'),
  'tomaten-knoblauch-dip': require('@/assets/rezepte/tomaten-knoblauch-dip.jpg'),
};

/** `null` laesst den Aufrufer auf sein Standard-Artwork zurueckfallen. */
export function getTemplateCoverImage(slug: string | null | undefined): ImageSourcePropType | null {
  if (!slug) return null;
  return TEMPLATE_COVER_IMAGES[slug] ?? null;
}
