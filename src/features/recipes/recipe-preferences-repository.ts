import { and, eq, not } from 'drizzle-orm';

import { getDrizzleDatabase } from '@/lib/db/client';
import { localRecipePreferences } from '@/lib/db/schemas';

export type LocalRecipeRating = {
  score: number;
  note: string;
  updatedAt: number;
};

function requireUserId(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Rezeptpräferenzen benötigen eine user_id.');
  }
  return normalizedUserId;
}

export async function listFavoriteRecipeKeys(userId: string): Promise<string[]> {
  const accountUserId = requireUserId(userId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .select({ recipeKey: localRecipePreferences.recipeKey })
    .from(localRecipePreferences)
    .where(
      and(
        eq(localRecipePreferences.userId, accountUserId),
        eq(localRecipePreferences.isFavorite, true),
      ),
    );
  return rows.map((row) => row.recipeKey);
}

/** Idempotenter Schreibpfad für die einmalige Legacy-Übernahme. */
export async function setStoredRecipeFavorite(
  userId: string,
  recipeKey: string,
  favorite: boolean,
): Promise<void> {
  const accountUserId = requireUserId(userId);
  const db = await getDrizzleDatabase();
  await db
    .insert(localRecipePreferences)
    .values({ userId: accountUserId, recipeKey, isFavorite: favorite, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: [localRecipePreferences.userId, localRecipePreferences.recipeKey],
      set: { isFavorite: favorite, updatedAt: Date.now() },
    });
}

export async function toggleStoredRecipeFavorite(
  userId: string,
  recipeKey: string,
): Promise<boolean> {
  const accountUserId = requireUserId(userId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .insert(localRecipePreferences)
    .values({ userId: accountUserId, recipeKey, isFavorite: true, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: [localRecipePreferences.userId, localRecipePreferences.recipeKey],
      set: {
        isFavorite: not(localRecipePreferences.isFavorite),
        updatedAt: Date.now(),
      },
    })
    .returning({ favorite: localRecipePreferences.isFavorite });

  return rows[0]?.favorite ?? false;
}

export async function readStoredRecipeRating(
  userId: string,
  recipeKey: string,
): Promise<LocalRecipeRating | null> {
  const accountUserId = requireUserId(userId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .select({
      score: localRecipePreferences.rating,
      note: localRecipePreferences.note,
      updatedAt: localRecipePreferences.updatedAt,
    })
    .from(localRecipePreferences)
    .where(
      and(
        eq(localRecipePreferences.userId, accountUserId),
        eq(localRecipePreferences.recipeKey, recipeKey),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.score) return null;
  return { score: row.score, note: row.note ?? '', updatedAt: row.updatedAt };
}

export async function writeStoredRecipeRating(
  userId: string,
  recipeKey: string,
  score: number,
  note: string,
  updatedAt = Date.now(),
): Promise<LocalRecipeRating> {
  const accountUserId = requireUserId(userId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .insert(localRecipePreferences)
    .values({
      userId: accountUserId,
      recipeKey,
      isFavorite: false,
      rating: score,
      note,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [localRecipePreferences.userId, localRecipePreferences.recipeKey],
      set: { rating: score, note, updatedAt },
    })
    .returning({
      score: localRecipePreferences.rating,
      note: localRecipePreferences.note,
      updatedAt: localRecipePreferences.updatedAt,
    });
  const row = rows[0];
  if (!row?.score) throw new Error('Die Rezeptbewertung konnte nicht gespeichert werden.');
  return { score: row.score, note: row.note ?? '', updatedAt: row.updatedAt };
}
