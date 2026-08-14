import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type DietaryTag,
  type Difficulty,
  type DishType,
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useAddStepMutation,
} from '@/features/recipes/use-recipes';
import { getSupabase } from '@/lib/supabase';

/**
 * Vorgefertigte Rezepte ("Vorlagen"): admin-kuratierte, global lesbare
 * Bibliothek (siehe supabase/schemas/15_recipe_templates.sql). Anders als
 * `recipes` wird diese Tabellenfamilie NICHT in die lokale SQLite-Mirror
 * aufgenommen (kein Eintrag in src/lib/db/entities.ts) — der Vorlagen-Screen
 * fragt live gegen Supabase ab, Templates sind kein Kern-Offline-Datensatz.
 * Browsen erfordert deshalb Netzverbindung.
 */

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

/** Liste aller Vorlagen, live von Supabase, sortiert nach Kuratierungs-Reihenfolge. */
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

/** Ein Template inkl. Komponente(n), Positionen und Zubereitungsschritten. */
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

/**
 * Uebernimmt eine Vorlage als neues Rezept in den Haushalt — ruft dieselbe
 * Sequenz bestehender Mutation-Hooks auf, die auch der Wizard in
 * recipe-create-screen.tsx's handleFinalSave nutzt (useAddRecipeMutation ->
 * useAddComponentMutation -> useAddItemMutation -> useAddStepMutation). Läuft
 * vollständig über den lokalen Outbox-Mechanismus, funktioniert also auch
 * offline, sobald das Template einmal geladen wurde.
 *
 * Bewusster Scope-Cut: keine recipe_step_ingredients-Verknüpfung (nur für die
 * Zutaten-Chips je Schritt relevant, keine funktionale Einbuße) und kein
 * Cover-Bild-Kopiervorgang (Templates haben in v1 kein Bild).
 */
export function useApplyRecipeTemplateMutation() {
  const queryClient = useQueryClient();
  const addRecipe = useAddRecipeMutation();
  const addComponent = useAddComponentMutation();
  const addItem = useAddItemMutation();
  const addStep = useAddStepMutation();

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
        cook_time_minutes: template.cook_time_minutes,
        difficulty: template.difficulty,
        dish_types: template.dish_types,
        dietary_tags: template.dietary_tags,
        default_servings: template.default_servings,
        created_by,
      });

      for (const component of template.components) {
        const newComponent = await addComponent.mutateAsync({
          recipe_id: recipe.id,
          household_id,
          name: component.name,
          serving_grams: component.serving_grams,
        });

        for (const item of component.items) {
          if (!item.product_id) continue; // sub_component_id-Verschachtelung nicht Teil der Vorlagen-Seed-Daten
          await addItem.mutateAsync({
            component_id: newComponent.id,
            recipe_id: recipe.id,
            household_id,
            product_id: item.product_id,
            grams: item.grams,
            quantity: item.quantity,
            unit: item.unit,
          });
        }
      }

      for (const step of template.steps) {
        await addStep.mutateAsync({
          recipe_id: recipe.id,
          household_id,
          position: step.position,
          text: step.text,
        });
      }

      return recipe;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
