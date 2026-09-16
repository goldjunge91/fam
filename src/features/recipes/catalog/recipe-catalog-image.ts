type CatalogCoverRecipe = {
  external_id: string;
  cover_image_path: string | null;
};

export function isCatalogStoragePath(path: string | null | undefined): boolean {
  const normalizedPath = path?.trim();
  return Boolean(normalizedPath && !/^https?:\/\//i.test(normalizedPath));
}

/**
 * Resolves the storage path for a catalog cover without creating a second
 * asset. Legacy template covers are already stored in `recipe-covers` under
 * the stable template id.
 */
export function getCatalogCoverPath(
  recipe: CatalogCoverRecipe,
  storedPath?: string | null,
): string | null {
  if (recipe.external_id.startsWith('template:')) {
    const templateId = recipe.external_id.slice('template:'.length).trim();
    if (templateId) return `templates/${templateId}.jpg`;
  }

  return storedPath ?? recipe.cover_image_path ?? null;
}
