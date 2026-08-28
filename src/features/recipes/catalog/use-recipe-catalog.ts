import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import { getSupabase } from '@/lib/supabase';
import {
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useAddStepIngredientMutation,
  useAddStepMutation,
  useUpdateRecipeMutation,
  useUpdateStepMutation,
} from '../use-recipes';

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
};

const client = () => getSupabase() as unknown as SupabaseClient;

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
      return (data ?? []) as CatalogRecipe[];
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
      return {
        recipe: recipe as CatalogRecipe,
        components: (components.data ?? []) as CatalogComponent[],
        items: (items.data ?? []) as CatalogItem[],
        steps: stepRows,
        stepIngredients: (stepIngredients.data ?? []) as CatalogStepIngredient[],
        images: (images.data ?? []) as { storage_path: string; position: number }[],
        stepImages: stepImages as { step_id: string; storage_path: string; position: number }[],
      };
    },
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
  const updateRecipe = useUpdateRecipeMutation();
  const updateStep = useUpdateStepMutation();
  return useMutation({
    mutationFn: async (detail: CatalogDetail) => {
      if (!activeHouseholdId || !session?.user.id) throw new Error('Kein aktiver Haushalt.');
      const recipe = await addRecipe.mutateAsync({
        household_id: activeHouseholdId,
        created_by: session.user.id,
        title: detail.recipe.title,
        instructions: detail.recipe.instructions,
        cook_time_minutes: detail.recipe.cook_time_minutes,
        difficulty: detail.recipe.difficulty,
        dish_types: detail.recipe.dish_types as never,
        dietary_tags: detail.recipe.dietary_tags as never,
        hashtags: detail.recipe.hashtags,
        default_servings: detail.recipe.default_servings,
      });
      const storage = getSupabase();
      const copyAsset = async (sourcePath: string, bucket: string, targetPath: string) => {
        const { data, error } = await storage.storage.from('recipe-catalog').download(sourcePath);
        if (error) throw error;
        const upload = await storage.storage
          .from(bucket)
          .upload(targetPath, await data.arrayBuffer(), {
            contentType: data.type || 'image/jpeg',
            upsert: true,
          });
        if (upload.error) throw upload.error;
        return targetPath;
      };
      const coverPath = detail.images[0]
        ? await copyAsset(
            detail.images[0].storage_path,
            'recipe-covers',
            `${activeHouseholdId}/${recipe.id}.jpg`,
          )
        : null;
      if (coverPath) {
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
        const created = await addComponent.mutateAsync({
          recipe_id: recipe.id,
          household_id: activeHouseholdId,
          name: component.name,
          serving_grams: component.serving_grams,
        });
        componentIds.set(component.id, created.id);
      }
      const itemIds = new Map<string, string>();
      for (const item of detail.items) {
        const productId =
          item.product_id ??
          (item.ingredient_name
            ? (
                await addProduct.mutateAsync({
                  name: item.ingredient_name,
                  source: 'manual',
                  created_by: session.user.id,
                })
              ).id
            : null);
        const created = await addItem.mutateAsync({
          component_id: componentIds.get(item.component_id) ?? '',
          recipe_id: recipe.id,
          household_id: activeHouseholdId,
          product_id: productId,
          sub_component_id: item.sub_component_id ? componentIds.get(item.sub_component_id) : null,
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
        if (stepId && itemId)
          await addStepIngredient.mutateAsync({
            step_id: stepId,
            recipe_id: recipe.id,
            household_id: activeHouseholdId,
            item_id: itemId,
          });
      }
      return recipe;
    },
    onSuccess: (recipe) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', activeHouseholdId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', recipe.id] });
    },
  });
}
