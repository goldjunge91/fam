import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { MAX_RECIPE_STEP_IMAGES } from '../wizard/types';

export type RecipeStep = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  image_path: string | null;
  images?: RecipeStepImage[];
  /** Optionaler, explizit gesetzter Kochmodus-Timer. */
  timer_minutes: number | null;
  /** IDs der referenzierten recipe_component_items (recipe_step_ingredients). */
  ingredientIds: string[];
};

export type RecipeStepImage = {
  id: string;
  step_id: string;
  recipe_id: string;
  household_id: string;
  storage_path: string;
  position: number;
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

export function useAddStepImageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      step_id: string;
      recipe_id: string;
      household_id: string;
      storage_path: string;
      position: number;
    }) => {
      if (input.position < 0 || input.position >= MAX_RECIPE_STEP_IMAGES) {
        throw new Error('Ein Rezeptschritt darf höchstens drei Bilder enthalten.');
      }

      const db = await getDatabase();
      const id = input.id ?? Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const activeImageCount = await db.getFirstAsync<{ count: number }>(
        'select count(*) as count from recipe_step_images where step_id = ? and deleted_at is null',
        [input.step_id],
      );
      if ((activeImageCount?.count ?? 0) >= MAX_RECIPE_STEP_IMAGES) {
        throw new Error('Ein Rezeptschritt darf höchstens drei Bilder enthalten.');
      }
      await enqueueMutation(db, {
        entity: 'recipe_step_images',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          step_id: input.step_id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          storage_path: input.storage_path,
          position: input.position,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_step_images',
            'insert',
            {
              id,
              step_id: input.step_id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              storage_path: input.storage_path,
              position: input.position,
              created_at: iso,
            },
            ms,
          ),
      });

      return { ...input, id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateStepImageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      step_id: string;
      recipe_id: string;
      household_id: string;
      position: number;
    }) => {
      if (input.position < 0 || input.position >= MAX_RECIPE_STEP_IMAGES) {
        throw new Error('Ein Rezeptschritt darf höchstens drei Bilder enthalten.');
      }

      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      await enqueueMutation(db, {
        entity: 'recipe_step_images',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          position: input.position,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_step_images',
            'update',
            { id: input.id, position: input.position },
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

export function useDeleteStepImageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      await enqueueMutation(db, {
        entity: 'recipe_step_images',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_step_images', 'delete', { id: input.id }, ms),
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
      const stepImages = await db.getAllAsync<{ id: string }>(
        'select id from recipe_step_images where step_id = ? and deleted_at is null',
        [input.id],
      );
      for (const stepImage of stepImages) {
        await enqueueMutation(db, {
          entity: 'recipe_step_images',
          entityId: stepImage.id,
          op: 'delete',
          payload: {
            id: stepImage.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'recipe_step_images', 'delete', { id: stepImage.id }, ms),
        });
      }
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
