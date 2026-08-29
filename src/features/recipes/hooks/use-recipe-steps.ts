import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type RecipeStep = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  image_path: string | null;
  /** Optionaler, explizit gesetzter Kochmodus-Timer. */
  timer_minutes: number | null;
  /** IDs der referenzierten recipe_component_items (recipe_step_ingredients). */
  ingredientIds: string[];
};

function nowStamp() {
  return { iso: new Date().toISOString(), ms: Date.now() };
}

// ------------------------------------------------------------- Schritte (Wizard)

export function useAddStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      recipe_id: string;
      household_id: string;
      position: number;
      text: string;
      image_path?: string | null;
      timer_minutes?: number | null;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const imagePath = input.image_path ?? null;
      const timerMinutes = input.timer_minutes ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          position: input.position,
          text: input.text,
          image_path: imagePath,
          timer_minutes: timerMinutes,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_steps',
            'insert',
            {
              id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              position: input.position,
              text: input.text,
              image_path: imagePath,
              timer_minutes: timerMinutes,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input, image_path: imagePath, timer_minutes: timerMinutes };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      position: number;
      text: string;
      image_path?: string | null;
      timer_minutes?: number | null;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const imagePath = input.image_path ?? null;
      const timerMinutes = input.timer_minutes ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          position: input.position,
          text: input.text,
          image_path: imagePath,
          timer_minutes: timerMinutes,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_steps',
            'update',
            {
              id: input.id,
              position: input.position,
              text: input.text,
              image_path: imagePath,
              timer_minutes: timerMinutes,
            },
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

export function useDeleteStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      // Zutaten-Referenzen dieses Schritts muessen einzeln als geloescht
      // markiert werden — analog zum Loeschen eines Rezepts, kein
      // serverseitiges Kaskadieren bei Soft-Delete.
      const stepIngredients = await db.getAllAsync<{ id: string }>(
        'select id from recipe_step_ingredients where step_id = ? and deleted_at is null',
        [input.id],
      );
      for (const stepIngredient of stepIngredients) {
        await enqueueMutation(db, {
          entity: 'recipe_step_ingredients',
          entityId: stepIngredient.id,
          op: 'delete',
          payload: {
            id: stepIngredient.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'recipe_step_ingredients',
              'delete',
              { id: stepIngredient.id },
              ms,
            ),
        });
      }

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_steps', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddStepIngredientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      step_id: string;
      item_id: string;
      recipe_id: string;
      household_id: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_step_ingredients',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          step_id: input.step_id,
          item_id: input.item_id,
          household_id: input.household_id,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_step_ingredients',
            'insert',
            {
              id,
              step_id: input.step_id,
              item_id: input.item_id,
              household_id: input.household_id,
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

export function useRemoveStepIngredientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_step_ingredients',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_step_ingredients', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
