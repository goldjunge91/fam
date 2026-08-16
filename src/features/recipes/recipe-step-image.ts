import { uploadImageToBucket, useSignedImageUrl } from './recipe-image-storage';

export { pickRecipeCoverImage as pickRecipeStepImage } from './recipe-cover';

const BUCKET = 'recipe-step-images';

/**
 * Laedt ein lokal ausgewaehltes Bild in den `recipe-step-images`-Bucket hoch.
 * Pfadkonvention `<household_id>/<step_id>.jpg` traegt die RLS in
 * `13_recipe_step_storage.sql`.
 */
export function uploadRecipeStepImage(
  localUri: string,
  householdId: string,
  stepId: string,
): Promise<string> {
  return uploadImageToBucket(BUCKET, `${householdId}/${stepId}.jpg`, localUri);
}

/** Signierte URL fuer die Anzeige — der Bucket ist privat (households-scoped). */
export function useRecipeStepImageUrl(path: string | null | undefined) {
  return useSignedImageUrl(BUCKET, 'RecipeStepImage', path);
}
