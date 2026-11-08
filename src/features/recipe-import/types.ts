export type RecipeImportSourceType = 'url' | 'text' | 'image' | 'pdf' | 'video';
export type RecipeImportMethod = 'structured' | 'ai';

export type RecipeImportDraft = {
  kind: 'recipe_import_draft.v1';
  title: string;
  servings: number | null;
  ingredients: Array<{
    text: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  steps: string[];
  notes: string | null;
  warnings: string[];
};

export type RecipeImportDraftRecord = {
  id: string;
  sourceType: RecipeImportSourceType;
  sourceLabel: string;
  sourceUrl: string | null;
  originalText: string | null;
  mediaUris: string[];
  method: RecipeImportMethod;
  draft: RecipeImportDraft;
  createdAt: string;
};

export type SavedRecipeImportSource = {
  recipeId: string;
  title: string;
  sourceUrl: string;
  normalizedSourceUrl: string;
  savedAt: string;
};
