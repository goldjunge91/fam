import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  type IngredientMappingReview,
  type IngredientMappingSourceContext,
  isCurrentIngredientMappingReview,
  UNKNOWN_INGREDIENT_MAPPING,
} from '@/features/recipes/domain/ingredient-mapping';
import type {
  RecipeComponentItemRow,
  RecipeComponentRow,
} from '@/features/recipes/domain/nutrition';
import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type RecipeComponent = RecipeComponentRow & { name: string; recipe_id: string };
export type RecipeComponentItem = RecipeComponentItemRow & {
  id: string;
  /** Nur bei Katalogzutaten ohne verknüpftes Produkt gesetzt. */
  ingredient_name?: string | null;
  quantity: number | null;
  unit: string;
  optional?: boolean;
  note?: string | null;
  sourceText?: string | null;
  ingredientSource?: IngredientMappingSourceContext | null;
  ingredientMapping?: IngredientMappingReview;
};

function nowStamp() {
  return { iso: new Date().toISOString(), ms: Date.now() };
}

function mappingForSource(
  mapping: IngredientMappingReview | undefined,
  source: IngredientMappingSourceContext | null | undefined,
): IngredientMappingReview {
  if (!mapping || !isCurrentIngredientMappingReview(mapping, source ?? null)) {
    return { ...UNKNOWN_INGREDIENT_MAPPING };
  }
  return mapping;
}

// ----------------------------------------------------------------- Mutations

export function useAddComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: {
      recipe_id: string;
      household_id: string;
      name: string;
      /** Nur bei obersten Komponenten gesetzt, siehe 11_recipes.sql. */
      serving_grams?: number | null;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const servingGrams = input.serving_grams ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          name: input.name,
          serving_grams: servingGrams,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_components',
            'insert',
            {
              id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              name: input.name,
              serving_grams: servingGrams,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      name: string;
      serving_grams?: number | null;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const servingGrams = input.serving_grams ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          name: input.name,
          serving_grams: servingGrams,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_components',
            'update',
            { id: input.id, name: input.name, serving_grams: servingGrams },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();

      // UI-Limit 2 Ebenen (#123-AC): eine Komponente, die als Unterkomponente
      // einer anderen benutzt wird, darf nicht geloescht werden, ohne diese
      // Referenz zuerst aufzuloesen — sonst zeigt eine verbleibende Position
      // ins Leere.
      const usedAsSubComponent = await db.getFirstAsync<{ id: string }>(
        'select id from recipe_component_items where sub_component_id = ? and deleted_at is null',
        [input.id],
      );
      if (usedAsSubComponent) {
        throw new Error(
          'Diese Komponente wird von einer anderen Komponente verwendet und kann nicht geloescht werden.',
        );
      }

      const { iso, ms } = nowStamp();

      const items = await db.getAllAsync<{ id: string }>(
        'select id from recipe_component_items where component_id = ? and deleted_at is null',
        [input.id],
      );
      for (const item of items) {
        await enqueueMutation(db, {
          entity: 'recipe_component_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'recipe_component_items', 'delete', { id: item.id }, ms),
        });
      }

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_components', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: {
      component_id: string;
      recipe_id: string;
      household_id: string;
      product_id?: string | null;
      sub_component_id?: string | null;
      grams: number;
      /** Rohe Nutzereingabe, siehe Kommentar auf recipe_component_items.quantity. */
      quantity?: number | null;
      unit?: string;
      optional?: boolean;
      note?: string | null;
      source_text?: string | null;
      ingredientSource?: IngredientMappingSourceContext | null;
      ingredientMapping?: IngredientMappingReview;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const productId = input.product_id ?? null;
      const subComponentId = input.sub_component_id ?? null;
      const quantity = input.quantity ?? null;
      const unit = input.unit ?? 'g';
      const optional = input.optional ?? false;
      const note = input.note ?? null;
      const sourceText = input.source_text ?? null;
      const ingredientSource = input.ingredientSource ?? null;
      const ingredientMapping = mappingForSource(input.ingredientMapping, ingredientSource);

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          component_id: input.component_id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          product_id: productId,
          sub_component_id: subComponentId,
          grams: input.grams,
          quantity,
          unit,
          optional,
          note,
          source_text: sourceText,
          ingredient_source_type: ingredientSource?.source ?? null,
          ingredient_source_id: ingredientSource?.sourceId ?? null,
          ingredient_source_url: ingredientSource?.sourceUrl ?? null,
          ingredient_source_version: ingredientSource?.sourceVersion ?? null,
          ingredient_source_license: ingredientSource?.license ?? null,
          ingredient_mapping: ingredientMapping,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_component_items',
            'insert',
            {
              id,
              component_id: input.component_id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              product_id: productId,
              sub_component_id: subComponentId,
              grams: input.grams,
              quantity,
              unit,
              optional,
              note,
              source_text: sourceText,
              ingredient_source_type: ingredientSource?.source ?? null,
              ingredient_source_id: ingredientSource?.sourceId ?? null,
              ingredient_source_url: ingredientSource?.sourceUrl ?? null,
              ingredient_source_version: ingredientSource?.sourceVersion ?? null,
              ingredient_source_license: ingredientSource?.license ?? null,
              ingredient_mapping: ingredientMapping,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input, quantity, unit, optional, note };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/** War frueher `useUpdateItemGramsMutation` — aendert jetzt auch quantity/unit, nicht nur grams. */
export function useUpdateItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      grams: number;
      quantity?: number | null;
      unit?: string;
      optional?: boolean;
      note?: string | null;
      source_text?: string | null;
      ingredientSource?: IngredientMappingSourceContext | null;
      product_id?: string | null;
      ingredientMapping?: IngredientMappingReview;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const quantity = input.quantity ?? null;
      const unit = input.unit ?? 'g';
      const ingredientSource = input.ingredientSource;
      const ingredientMapping = mappingForSource(input.ingredientMapping, ingredientSource);
      const patch = {
        grams: input.grams,
        quantity,
        unit,
        ...(input.optional !== undefined && { optional: input.optional }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.source_text !== undefined && { source_text: input.source_text }),
        ...(ingredientSource !== undefined && {
          ingredient_source_type: ingredientSource?.source ?? null,
          ingredient_source_id: ingredientSource?.sourceId ?? null,
          ingredient_source_url: ingredientSource?.sourceUrl ?? null,
          ingredient_source_version: ingredientSource?.sourceVersion ?? null,
          ingredient_source_license: ingredientSource?.license ?? null,
        }),
        ...(input.product_id !== undefined && { product_id: input.product_id }),
        ...((input.ingredientMapping !== undefined || ingredientSource !== undefined) && {
          ingredient_mapping: ingredientMapping,
        }),
        ...(input.product_id !== undefined &&
          input.ingredientMapping === undefined &&
          ingredientSource === undefined && {
            ingredient_mapping: { ...UNKNOWN_INGREDIENT_MAPPING },
          }),
      };

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          ...patch,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_component_items',
            'update',
            { id: input.id, ...patch },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_component_items', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
