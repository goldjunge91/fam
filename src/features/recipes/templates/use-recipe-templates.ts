import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  calculateServingNutrition,
  type ProductNutritionRow,
  type RecipeComponentItemRow,
  type RecipeComponentRow,
} from '@/features/recipes/nutrition';
import {
  type DietaryTag,
  type Difficulty,
  type DishType,
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useAddStepIngredientMutation,
  useAddStepMutation,
} from '@/features/recipes/use-recipes';
import { getSupabase } from '@/lib/supabase';

/** Kuratierte Vorlagen werden live aus Supabase statt dem Offline-Spiegel gelesen. */

export type RecipeTemplateListItem = {
  id: string;
  title: string;
  cover_image_path: string | null;
  cook_time_minutes: number | null;
  difficulty: Difficulty | null;
  dish_types: DishType[];
  dietary_tags: DietaryTag[];
  default_servings: number;
  sort_order: number;
};

export type RecipeTemplateItem = {
  id: string;
  component_id: string;
  product_id: string | null;
  sub_component_id: string | null;
  grams: number;
  quantity: number | null;
  unit: string;
  product_name: string | null;
};

export type RecipeTemplateComponent = {
  id: string;
  name: string;
  serving_grams: number | null;
  items: RecipeTemplateItem[];
};

export type RecipeTemplateStep = {
  id: string;
  position: number;
  text: string;
};

export type RecipeTemplateDetail = RecipeTemplateListItem & {
  instructions: string | null;
  components: RecipeTemplateComponent[];
  steps: RecipeTemplateStep[];
};

export function useRecipeTemplates() {
  return useQuery({
    queryKey: ['recipe-templates'],
    queryFn: async (): Promise<RecipeTemplateListItem[]> => {
      const { data, error } = await getSupabase()
        .from('recipe_templates')
        .select(
          'id, title, cover_image_path, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order',
        )
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as RecipeTemplateListItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type RecipeTemplateWithNutrition = RecipeTemplateListItem & {
  /** kcal/Protein/Kohlenhydrate fuer 1 Portion, `null` ohne Komponenten oder Naehrwertdaten. */
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
};

/** Ergaenzt alle Vorlagen per Batch-Abfragen um clientseitige Portionswerte. */
export function useRecipeTemplatesWithNutrition() {
  return useQuery({
    queryKey: ['recipe-templates', 'with-nutrition'],
    queryFn: async (): Promise<RecipeTemplateWithNutrition[]> => {
      const supabase = getSupabase();

      const [
        { data: templates, error: templatesError },
        { data: components, error: componentsError },
        { data: items, error: itemsError },
      ] = await Promise.all([
        supabase
          .from('recipe_templates')
          .select(
            'id, title, cover_image_path, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order',
          )
          .order('sort_order', { ascending: true }),
        supabase.from('recipe_template_components').select('id, template_id, serving_grams'),
        supabase
          .from('recipe_template_items')
          .select(
            'component_id, template_id, product_id, sub_component_id, grams, products(id, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100)',
          ),
      ]);

      if (templatesError) throw templatesError;
      if (componentsError) throw componentsError;
      if (itemsError) throw itemsError;

      type ItemRow = {
        component_id: string;
        template_id: string;
        product_id: string | null;
        sub_component_id: string | null;
        grams: number;
        products: ProductNutritionRow | null;
      };

      const productsById = new Map<string, ProductNutritionRow>();
      const itemsByTemplate = new Map<string, RecipeComponentItemRow[]>();
      for (const row of (items ?? []) as ItemRow[]) {
        if (row.products) productsById.set(row.products.id, row.products);
        const list = itemsByTemplate.get(row.template_id) ?? [];
        list.push({
          component_id: row.component_id,
          product_id: row.product_id,
          sub_component_id: row.sub_component_id,
          grams: row.grams,
        });
        itemsByTemplate.set(row.template_id, list);
      }

      const componentsByTemplate = new Map<string, RecipeComponentRow[]>();
      type ComponentRow = { id: string; template_id: string; serving_grams: number | null };
      for (const row of (components ?? []) as ComponentRow[]) {
        const list = componentsByTemplate.get(row.template_id) ?? [];
        list.push({ id: row.id, serving_grams: row.serving_grams });
        componentsByTemplate.set(row.template_id, list);
      }

      return ((templates ?? []) as RecipeTemplateListItem[]).map((template) => {
        const templateComponents = componentsByTemplate.get(template.id) ?? [];
        const templateItems = itemsByTemplate.get(template.id) ?? [];
        const nutrition = calculateServingNutrition(
          templateComponents,
          templateItems,
          productsById,
        );
        const hasNutrition = nutrition.kcal > 0;
        return {
          ...template,
          kcalPerServing: hasNutrition ? Math.round(nutrition.kcal) : null,
          proteinGPerServing: hasNutrition ? Math.round(nutrition.protein_g) : null,
          carbsGPerServing: hasNutrition ? Math.round(nutrition.carbs_g) : null,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type CalorieBucket = { min: number; max: number; label: string };

export const CALORIE_BUCKETS: CalorieBucket[] = [
  { min: 50, max: 100, label: '50–100' },
  { min: 100, max: 200, label: '100–200' },
  { min: 200, max: 300, label: '200–300' },
  { min: 300, max: 400, label: '300–400' },
  { min: 400, max: 500, label: '400–500' },
  { min: 500, max: 600, label: '500–600' },
  { min: 600, max: 700, label: '600–700' },
  { min: 700, max: 800, label: '700–800' },
  { min: 800, max: 900, label: '800–900' },
  { min: 900, max: 1000, label: '900–1000' },
];

/** Die obere Bucket-Grenze ist inklusive. */
export function isInCalorieBucket(kcal: number, bucket: CalorieBucket): boolean {
  return kcal > bucket.min && kcal <= bucket.max;
}

/** Leitet High-Protein und Low-Carb direkt aus Portionswerten statt Tags ab. */
export function isHighProteinTemplate(template: RecipeTemplateWithNutrition): boolean {
  if (!template.kcalPerServing || !template.proteinGPerServing) return false;
  return (template.proteinGPerServing * 4) / template.kcalPerServing >= 0.25;
}

export function isLowCarbTemplate(template: RecipeTemplateWithNutrition): boolean {
  return template.carbsGPerServing !== null && template.carbsGPerServing < 20;
}

export function useRecipeTemplateDetail(templateId: string | undefined) {
  return useQuery({
    queryKey: ['recipe-template-detail', templateId],
    queryFn: async (): Promise<RecipeTemplateDetail | null> => {
      if (!templateId) return null;
      const supabase = getSupabase();

      const [
        { data: template, error: templateError },
        { data: components, error: componentsError },
        { data: steps, error: stepsError },
      ] = await Promise.all([
        supabase
          .from('recipe_templates')
          .select(
            'id, title, instructions, cover_image_path, cook_time_minutes, difficulty, dish_types, dietary_tags, default_servings, sort_order',
          )
          .eq('id', templateId)
          .maybeSingle(),
        supabase
          .from('recipe_template_components')
          .select('id, name, serving_grams')
          .eq('template_id', templateId),
        supabase
          .from('recipe_template_steps')
          .select('id, position, text')
          .eq('template_id', templateId)
          .order('position', { ascending: true }),
      ]);

      if (templateError) throw templateError;
      if (componentsError) throw componentsError;
      if (stepsError) throw stepsError;
      if (!template) return null;

      const componentIds = (components ?? []).map((c: { id: string }) => c.id);
      let items: RecipeTemplateItem[] = [];
      if (componentIds.length > 0) {
        const { data: itemRows, error: itemsError } = await supabase
          .from('recipe_template_items')
          .select(
            'id, component_id, product_id, sub_component_id, grams, quantity, unit, products(name)',
          )
          .in('component_id', componentIds);
        if (itemsError) throw itemsError;
        type ItemRow = {
          id: string;
          component_id: string;
          product_id: string | null;
          sub_component_id: string | null;
          grams: number;
          quantity: number | null;
          unit: string;
          products: { name: string } | null;
        };
        items = (itemRows ?? []).map((row: ItemRow) => ({
          id: row.id,
          component_id: row.component_id,
          product_id: row.product_id,
          sub_component_id: row.sub_component_id,
          grams: row.grams,
          quantity: row.quantity,
          unit: row.unit,
          product_name: row.products?.name ?? null,
        }));
      }

      type ComponentRow = { id: string; name: string; serving_grams: number | null };
      const componentList: RecipeTemplateComponent[] = (components ?? []).map(
        (c: ComponentRow) => ({
          id: c.id,
          name: c.name,
          serving_grams: c.serving_grams,
          items: items.filter((i) => i.component_id === c.id),
        }),
      );

      return {
        ...(template as RecipeTemplateListItem),
        instructions: (template as { instructions: string | null }).instructions ?? null,
        components: componentList,
        steps: (steps ?? []) as RecipeTemplateStep[],
      };
    },
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Kopiert eine geladene Vorlage ueber die Outbox und haengt Zutaten sichtbar an Schritt eins. */
export function useApplyRecipeTemplateMutation() {
  const queryClient = useQueryClient();
  const addRecipe = useAddRecipeMutation();
  const addComponent = useAddComponentMutation();
  const addItem = useAddItemMutation();
  const addStep = useAddStepMutation();
  const addStepIngredient = useAddStepIngredientMutation();

  return useMutation({
    mutationFn: async (input: {
      template: RecipeTemplateDetail;
      household_id: string;
      created_by: string;
    }) => {
      const { template, household_id, created_by } = input;

      const recipe = await addRecipe.mutateAsync({
        household_id,
        title: template.title,
        instructions: template.instructions,
        cover_image_path: template.cover_image_path,
        cook_time_minutes: template.cook_time_minutes,
        difficulty: template.difficulty,
        dish_types: template.dish_types,
        dietary_tags: template.dietary_tags,
        default_servings: template.default_servings,
        created_by,
      });

      const newItemIds: string[] = [];

      for (const component of template.components) {
        // Komponenten ohne serving_grams waeren im Detail unsichtbar.
        const servingGrams =
          component.serving_grams ?? component.items.reduce((sum, item) => sum + item.grams, 0);

        const newComponent = await addComponent.mutateAsync({
          recipe_id: recipe.id,
          household_id,
          name: component.name,
          serving_grams: servingGrams,
        });

        for (const item of component.items) {
          if (!item.product_id) continue;
          const newItem = await addItem.mutateAsync({
            component_id: newComponent.id,
            recipe_id: recipe.id,
            household_id,
            product_id: item.product_id,
            grams: item.grams,
            quantity: item.quantity,
            unit: item.unit,
          });
          newItemIds.push(newItem.id);
        }
      }

      let firstStepId: string | null = null;
      for (const step of template.steps) {
        const newStep = await addStep.mutateAsync({
          recipe_id: recipe.id,
          household_id,
          position: step.position,
          text: step.text,
        });
        if (firstStepId === null) firstStepId = newStep.id;
      }

      if (firstStepId !== null) {
        for (const itemId of newItemIds) {
          await addStepIngredient.mutateAsync({
            step_id: firstStepId,
            item_id: itemId,
            recipe_id: recipe.id,
            household_id,
          });
        }
      }

      return recipe;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
