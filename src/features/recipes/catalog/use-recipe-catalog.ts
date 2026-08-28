import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import {
  calculateServingNutrition,
  type NutritionTotal,
  type ProductNutritionRow,
} from '@/features/recipes/domain/nutrition';
import { getSupabase } from '@/lib/supabase';
import {
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useAddStepIngredientMutation,
  useAddStepMutation,
  useDeleteRecipeMutation,
  useUpdateRecipeMutation,
  useUpdateStepMutation,
} from '../data/use-recipes';
import { getCatalogCoverPath } from './recipe-catalog-image';

export type CatalogRecipe = {
  id: string;
  external_id: string;
  slug: string;
  title: string;
  instructions: string | null;
  cook_time_minutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  dish_types: string[];
  dietary_tags: string[];
  hashtags: string[];
  default_servings: number;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  source_url: string | null;
  cover_image_path: string | null;
};
export type CatalogComponent = {
  id: string;
  recipe_id: string;
  name: string;
  serving_grams: number | null;
  position: number;
};
export type CatalogItem = {
  id: string;
  component_id: string;
  recipe_id: string;
  product_id: string | null;
  sub_component_id: string | null;
  ingredient_name: string | null;
  grams: number;
  quantity: number | null;
  unit: string;
  position: number;
};
export type CatalogStep = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  timer_minutes: number | null;
};
export type CatalogStepIngredient = {
  step_id: string;
  item_id: string;
  recipe_id: string;
  position: number;
};
export type CatalogDetail = {
  recipe: CatalogRecipe;
  components: CatalogComponent[];
  items: CatalogItem[];
  steps: CatalogStep[];
  stepIngredients: CatalogStepIngredient[];
  images: { storage_path: string; position: number }[];
  stepImages: { step_id: string; storage_path: string; position: number }[];
  productsById: Map<string, { name: string } & ProductNutritionRow>;
  nutrition: NutritionTotal;
};

const client = () => getSupabase() as unknown as SupabaseClient;

function templateCoverPath(detail: CatalogDetail): string | null {
  return getCatalogCoverPath(detail.recipe, detail.images[0]?.storage_path);
}

function validateCopyDetail(detail: CatalogDetail) {
  const componentIds = new Set<string>();
  for (const component of detail.components) {
    if (!component.id || componentIds.has(component.id))
      throw new Error('Das Katalogrezept enthält doppelte Zutaten-Gruppen.');
    if (!component.name.trim()) throw new Error('Eine Zutaten-Gruppe hat keinen Namen.');
    componentIds.add(component.id);
  }

  const itemIds = new Set<string>();
  for (const item of detail.items) {
    if (!item.id || itemIds.has(item.id))
      throw new Error('Das Katalogrezept enthält doppelte Zutaten.');
    if (!componentIds.has(item.component_id))
      throw new Error('Eine Zutat verweist auf eine nicht vorhandene Zutaten-Gruppe.');

    const targets = [
      Boolean(item.product_id),
      Boolean(item.sub_component_id),
      Boolean(item.ingredient_name?.trim()),
    ].filter(Boolean).length;
    if (targets !== 1) throw new Error('Eine Katalogzutat hat kein eindeutiges Ziel.');
    if (item.sub_component_id && !componentIds.has(item.sub_component_id))
      throw new Error('Eine Zutat verweist auf eine nicht vorhandene Untergruppe.');
    if (item.sub_component_id === item.component_id)
      throw new Error('Eine Zutaten-Gruppe kann nicht sich selbst enthalten.');
    if (!Number.isFinite(item.grams) || item.grams <= 0)
      throw new Error('Eine Katalogzutat hat keine gültige Grammmenge.');
    itemIds.add(item.id);
  }

  const stepIds = new Set<string>();
  for (const step of detail.steps) {
    if (!step.id || stepIds.has(step.id))
      throw new Error('Das Katalogrezept enthält doppelte Zubereitungsschritte.');
    if (!step.text.trim()) throw new Error('Ein Zubereitungsschritt ist leer.');
    stepIds.add(step.id);
  }

  for (const link of detail.stepIngredients) {
    if (!stepIds.has(link.step_id) || !itemIds.has(link.item_id))
      throw new Error('Eine Schritt-Zutaten-Verknüpfung ist ungültig.');
  }
}

export function useCatalogRecipes() {
  return useQuery({
    queryKey: ['catalog-recipes'],
    queryFn: async () => {
      const { data, error } = await client()
        .from('catalog_recipes')
        .select('*')
        .eq('status', 'published')
        .order('sort_order')
        .order('title');
      if (error) throw error;
      const recipes = (data ?? []) as CatalogRecipe[];
      const images = recipes.length
        ? await client()
            .from('catalog_recipe_images')
            .select('recipe_id, storage_path')
            .in(
              'recipe_id',
              recipes.map((recipe) => recipe.id),
            )
            .order('position')
        : { data: [], error: null };
      if (images.error) throw images.error;
      const coverByRecipe = new Map<string, string>();
      for (const image of images.data ?? [])
        if (!coverByRecipe.has(image.recipe_id as string))
          coverByRecipe.set(image.recipe_id as string, image.storage_path as string);
      return recipes.map((recipe) => ({
        ...recipe,
        cover_image_path: getCatalogCoverPath(recipe, coverByRecipe.get(recipe.id)),
      }));
    },
  });
}

export function useCatalogRecipe(slug: string | undefined) {
  return useQuery({
    queryKey: ['catalog-recipe', slug],
    enabled: !!slug,
    queryFn: async (): Promise<CatalogDetail | null> => {
      if (!slug) return null;
      const db = client();
      const { data: recipe, error } = await db
        .from('catalog_recipes')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();
      if (error) throw error;
      const [components, items, steps, stepIngredients, images] = await Promise.all([
        db
          .from('catalog_recipe_components')
          .select('*')
          .eq('recipe_id', recipe.id)
          .order('position'),
        db
          .from('catalog_recipe_component_items')
          .select('*')
          .eq('recipe_id', recipe.id)
          .order('position'),
        db.from('catalog_recipe_steps').select('*').eq('recipe_id', recipe.id).order('position'),
        db
          .from('catalog_recipe_step_ingredients')
          .select('*')
          .eq('recipe_id', recipe.id)
          .order('position'),
        db
          .from('catalog_recipe_images')
          .select('storage_path, position')
          .eq('recipe_id', recipe.id)
          .order('position'),
      ]);
      for (const result of [components, items, steps, stepIngredients, images])
        if (result.error) throw result.error;
      const catalogItems = (items.data ?? []) as CatalogItem[];
      const productIds = [
        ...new Set(catalogItems.flatMap((item) => (item.product_id ? [item.product_id] : []))),
      ];
      const products = productIds.length
        ? await db
            .from('products')
            .select('id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100')
            .in('id', productIds)
        : { data: [], error: null };
      if (products.error) throw products.error;
      const stepRows = (steps.data ?? []) as CatalogStep[];
      const stepImages = stepRows.length
        ? ((
            await db
              .from('catalog_recipe_step_images')
              .select('step_id, storage_path, position')
              .in(
                'step_id',
                stepRows.map((step) => step.id),
              )
              .order('position')
          ).data ?? [])
        : [];
      const productRows = (products.data ?? []) as ({ name: string } & ProductNutritionRow)[];
      const productsById = new Map(productRows.map((product) => [product.id, product]));
      const nutritionComponents = (components.data ?? []).map((component) => ({
        id: component.id as string,
        serving_grams:
          component.serving_grams ??
          catalogItems
            .filter((item) => item.component_id === component.id)
            .reduce((sum, item) => sum + item.grams, 0),
      }));
      const nutrition = calculateServingNutrition(nutritionComponents, catalogItems, productsById);

      return {
        recipe: {
          ...(recipe as CatalogRecipe),
          cover_image_path: getCatalogCoverPath(
            recipe as CatalogRecipe,
            (images.data?.[0] as { storage_path?: string } | undefined)?.storage_path,
          ),
        },
        components: (components.data ?? []) as CatalogComponent[],
        items: catalogItems,
        steps: stepRows,
        stepIngredients: (stepIngredients.data ?? []) as CatalogStepIngredient[],
        images: (images.data ?? []) as { storage_path: string; position: number }[],
        stepImages: stepImages as { step_id: string; storage_path: string; position: number }[],
        productsById,
        nutrition,
      };
    },
  });
}

export function useCatalogImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['catalog-image-url', path],
    enabled: Boolean(path),
    queryFn: async () => {
      if (!path) return null;
      const buckets = path.startsWith('templates/')
        ? ['recipe-covers']
        : ['recipe-catalog', 'recipe-covers'];
      for (const bucket of buckets) {
        const { data, error } = await client().storage.from(bucket).createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
      }
      return null;
    },
    staleTime: 50 * 60 * 1000,
  });
}

export function useCopyCatalogRecipeMutation() {
  const queryClient = useQueryClient();
  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const addRecipe = useAddRecipeMutation();
  const addComponent = useAddComponentMutation();
  const addItem = useAddItemMutation();
  const addStep = useAddStepMutation();
  const addStepIngredient = useAddStepIngredientMutation();
  const addProduct = useAddProductMutation();
  const deleteRecipe = useDeleteRecipeMutation();
  const updateRecipe = useUpdateRecipeMutation();
  const updateStep = useUpdateStepMutation();
  return useMutation({
    mutationFn: async (detail: CatalogDetail) => {
      if (!activeHouseholdId || !session?.user.id) throw new Error('Kein aktiver Haushalt.');
      validateCopyDetail(detail);

      const sourceCoverPath = templateCoverPath(detail);
      let createdRecipe: { id: string } | null = null;
      const uploadedAssets: Array<{ bucket: string; path: string }> = [];
      const storage = getSupabase();
      try {
        // Legacy template covers already live in `recipe-covers` and are
        // readable below `templates/`. Keep that path on the copied recipe;
        // only assets from the separate catalog bucket need a household copy.
        const isReusableTemplateCover = sourceCoverPath?.startsWith('templates/') ?? false;
        const recipe = await addRecipe.mutateAsync({
          household_id: activeHouseholdId,
          created_by: session.user.id,
          title: detail.recipe.title,
          instructions: detail.recipe.instructions,
          cover_image_path: isReusableTemplateCover ? sourceCoverPath : null,
          cook_time_minutes: detail.recipe.cook_time_minutes,
          difficulty: detail.recipe.difficulty,
          dish_types: detail.recipe.dish_types as never,
          dietary_tags: detail.recipe.dietary_tags as never,
          hashtags: detail.recipe.hashtags,
          default_servings: detail.recipe.default_servings,
        });
        createdRecipe = recipe;

        const copyAsset = async (
          sourceBucket: string,
          sourcePath: string,
          targetBucket: string,
          targetPath: string,
        ) => {
          const { data, error } = await storage.storage.from(sourceBucket).download(sourcePath);
          if (error) throw error;
          const upload = await storage.storage
            .from(targetBucket)
            .upload(targetPath, await data.arrayBuffer(), {
              contentType: data.type || 'image/jpeg',
              upsert: false,
            });
          if (upload.error) throw upload.error;
          uploadedAssets.push({ bucket: targetBucket, path: targetPath });
          return targetPath;
        };

        let coverPath = sourceCoverPath;
        if (coverPath && !isReusableTemplateCover) {
          coverPath = await copyAsset(
            'recipe-catalog',
            coverPath,
            'recipe-covers',
            `${activeHouseholdId}/${recipe.id}.jpg`,
          );
          await updateRecipe.mutateAsync({
            id: recipe.id,
            household_id: activeHouseholdId,
            title: detail.recipe.title,
            instructions: detail.recipe.instructions,
            cover_image_path: coverPath,
            cook_time_minutes: detail.recipe.cook_time_minutes,
            difficulty: detail.recipe.difficulty,
            dish_types: detail.recipe.dish_types as never,
            dietary_tags: detail.recipe.dietary_tags as never,
            hashtags: detail.recipe.hashtags,
            default_servings: detail.recipe.default_servings,
          });
        }

        const componentIds = new Map<string, string>();
        for (const component of detail.components) {
          const componentItems = detail.items.filter((item) => item.component_id === component.id);
          const servingGrams =
            component.serving_grams ??
            componentItems.reduce((sum, item) => sum + (Number.isFinite(item.grams) ? item.grams : 0), 0);
          const created = await addComponent.mutateAsync({
            recipe_id: recipe.id,
            household_id: activeHouseholdId,
            name: component.name,
            serving_grams: servingGrams > 0 ? servingGrams : null,
          });
          componentIds.set(component.id, created.id);
        }

        const itemIds = new Map<string, string>();
        const manualProductIds = new Map<string, string>();
        for (const item of detail.items) {
          let productId = item.product_id;
          if (!productId && item.ingredient_name) {
            const productKey = item.ingredient_name.trim().toLocaleLowerCase();
            productId = manualProductIds.get(productKey) ?? null;
            if (!productId) {
              productId = (
                await addProduct.mutateAsync({
                  name: item.ingredient_name.trim(),
                  source: 'manual',
                  created_by: session.user.id,
                })
              ).id;
              manualProductIds.set(productKey, productId);
            }
          }
          const componentId = componentIds.get(item.component_id);
          const subComponentId = item.sub_component_id
            ? componentIds.get(item.sub_component_id)
            : null;
          if (!componentId || (item.sub_component_id && !subComponentId))
            throw new Error('Die Zutaten-Gruppen konnten nicht zugeordnet werden.');
          const created = await addItem.mutateAsync({
            component_id: componentId,
            recipe_id: recipe.id,
            household_id: activeHouseholdId,
            product_id: productId,
            sub_component_id: subComponentId,
            grams: item.grams,
            quantity: item.quantity,
            unit: item.unit,
          });
          itemIds.set(item.id, created.id);
        }

        const stepIds = new Map<string, string>();
        for (const step of detail.steps) {
          const created = await addStep.mutateAsync({
            recipe_id: recipe.id,
            household_id: activeHouseholdId,
            position: step.position,
            text: step.text,
            timer_minutes: step.timer_minutes,
            image_path: null,
          });
          stepIds.set(step.id, created.id);
          const stepImage = detail.stepImages.find((image) => image.step_id === step.id);
          if (stepImage) {
            const imagePath = await copyAsset(
              'recipe-catalog',
              stepImage.storage_path,
              'recipe-step-images',
              `${activeHouseholdId}/${created.id}.jpg`,
            );
            await updateStep.mutateAsync({
              id: created.id,
              recipe_id: recipe.id,
              household_id: activeHouseholdId,
              position: step.position,
              text: step.text,
              timer_minutes: step.timer_minutes,
              image_path: imagePath,
            });
          }
        }

        for (const link of detail.stepIngredients) {
          const stepId = stepIds.get(link.step_id);
          const itemId = itemIds.get(link.item_id);
          if (!stepId || !itemId) throw new Error('Schritt-Zutaten konnten nicht zugeordnet werden.');
          await addStepIngredient.mutateAsync({
            step_id: stepId,
            recipe_id: recipe.id,
            household_id: activeHouseholdId,
            item_id: itemId,
          });
        }
        return recipe;
      } catch (error) {
        // All database writes above belong to this newly created recipe. Remove
        // only that recipe and its children. Never touch an existing recipe.
        const cleanupErrors: string[] = [];
        if (createdRecipe) {
          try {
            await deleteRecipe.mutateAsync({
              id: createdRecipe.id,
              household_id: activeHouseholdId,
            });
          } catch (cleanupError) {
            cleanupErrors.push(
              cleanupError instanceof Error ? cleanupError.message : 'Unbekannter Rezept-Cleanup-Fehler',
            );
          }
        }

        // A non-template cover or step image is the only asset this flow may
        // upload. Remove those newly created files on failure; legacy template
        // covers are only referenced and are never touched.
        for (const asset of uploadedAssets) {
          try {
            const { error: removeError } = await storage.storage
              .from(asset.bucket)
              .remove([asset.path]);
            if (removeError) cleanupErrors.push(removeError.message);
          } catch (removeError) {
            cleanupErrors.push(
              removeError instanceof Error ? removeError.message : 'Unbekannter Asset-Cleanup-Fehler',
            );
          }
        }

        if (cleanupErrors.length > 0) {
          const originalMessage =
            error instanceof Error ? error.message : 'Rezept konnte nicht kopiert werden';
          throw new Error(`${originalMessage} (Cleanup fehlgeschlagen: ${cleanupErrors.join('; ')})`);
        }
        throw error;
      }
    },
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', activeHouseholdId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', recipe.id] });
    },
  });
}
