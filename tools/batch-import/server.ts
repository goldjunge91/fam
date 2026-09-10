#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { importLegacyTemplates } from './legacy-template-import';

const PORT = Number(process.env.RECIPE_CATALOG_PORT ?? 8787);
const item = z
  .object({
    key: z.string().min(1),
    ingredientName: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    subComponentKey: z.string().min(1).optional(),
    grams: z.number().positive(),
    quantity: z.number().positive().optional(),
    unit: z.enum(['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion']).default('g'),
    position: z.number().int().nonnegative().default(0),
    optional: z.boolean().default(false),
    source_note: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      Number(Boolean(value.ingredientName)) +
        Number(Boolean(value.productId)) +
        Number(Boolean(value.subComponentKey)) ===
      1,
    'Genau eine Zutat, productId oder Untergruppe angeben.',
  );
const substitution = z.object({
  forIngredientId: z.string().min(1),
  swap: z.string().min(1),
  savings: z.string().optional(),
});
const image = z
  .object({
    storagePath: z.string().min(1).nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    localPath: z.string().min(1).nullable().optional(),
    sourcePageUrl: z.string().url().nullable().optional(),
    sourceName: z.string().nullable().optional(),
    license: z.string().nullable().optional(),
    attributionRequired: z.boolean().default(false),
    attributionText: z.string().nullable().optional(),
    verifiedMatch: z.boolean().default(false),
    altText: z.string().nullable().optional(),
    position: z.number().int().nonnegative().default(0),
  })
  .refine(
    (value) => Boolean(value.storagePath ?? value.sourceUrl ?? value.localPath),
    'Ein Bild braucht storagePath, sourceUrl oder localPath.',
  );
const component = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(120),
  servingGrams: z.number().positive().nullable().optional(),
  position: z.number().int().nonnegative().default(0),
  items: z.array(item).default([]),
});
const step = z.object({
  position: z.number().int().nonnegative(),
  text: z.string().min(1).max(2000),
  timerMinutes: z.number().int().positive().nullable().optional(),
  ingredientKeys: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
});
const batchRecipe = z.object({
  externalId: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  instructions: z.string().nullable().optional(),
  prepTimeMinutes: z.number().int().positive().nullable().optional(),
  cookTimeMinutes: z.number().int().positive().nullable().optional(),
  storageInstructions: z.string().nullable().optional(),
  reheatingInstructions: z.string().nullable().optional(),
  cheapTips: z.array(z.string()).default([]),
  substitutions: z.array(substitution).default([]),
  crispinessLevel: z.string().nullable().optional(),
  airFryerTimeMinutes: z.number().int().positive().nullable().optional(),
  airFryerTemperatureF: z.number().int().positive().nullable().optional(),
  variantGroup: z.string().nullable().optional(),
  variantType: z.string().nullable().optional(),
  dormFriendly: z.boolean().nullable().optional(),
  mealPrepFriendly: z.boolean().nullable().optional(),
  whyCheap: z.string().nullable().optional(),
  healthierTips: z.array(z.string()).default([]),
  batchPrepTips: z.array(z.string()).default([]),
  optionalAddIns: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  dishTypes: z.array(z.string()).default([]),
  dietaryTags: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  defaultServings: z.number().int().positive().default(1),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  sortOrder: z.number().int().default(0),
  sourceUrl: z.string().url().nullable().optional(),
  cover: z.string().optional(),
  components: z.array(component).default([]),
  steps: z.array(step).default([]),
  images: z.array(image).default([]),
});
const batchSchema = z
  .object({
    format: z.string().optional(),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    source: z
      .object({ repository: z.string().url(), dataset: z.string().min(1) })
      .optional(),
    recipes: z.array(batchRecipe),
    warnings: z.array(z.unknown()).optional(),
  })
  .superRefine((batch, ctx) => {
    for (const field of ['externalId', 'slug'] as const) {
      const seen = new Map<string, number>();
      batch.recipes.forEach((recipe, index) => {
        const value = recipe[field];
        const previous = seen.get(value);
        if (previous !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['recipes', index, field],
            message: `${field} doppelt (bereits in Rezept ${previous + 1})`,
          });
        } else {
          seen.set(value, index);
        }
      });
    }
  });
type Batch = z.infer<typeof batchSchema>;
const required = (name:string, ...aliases:string[]) => {
  const value = [name, ...aliases].map((key) => process.env[key]?.trim()).find(Boolean);
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
};
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [value.message, value.details, value.hint, value.code].filter((part) => part != null && String(part).length > 0).map(String).join(' | ') || JSON.stringify(error);
  }
  return String(error);
};

const imageContentType = (imagePath: string) => {
  switch (path.extname(imagePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

type ImportProgress = { completed: number; total: number; current: string };

async function importBatch(
  batch: Batch,
  assetRoot: string,
  onProgress?: (progress: ImportProgress) => void,
) {
  const db = createClient(
    required('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const report = [];
  onProgress?.({ completed: 0, total: batch.recipes.length, current: '' });
  for (const [index, recipe] of batch.recipes.entries()) {
    const { data: savedRecipe, error } = await db
      .from('catalog_recipes')
      .upsert(
        {
          external_id: recipe.externalId,
          slug: recipe.slug,
          title: recipe.title,
          instructions: recipe.instructions ?? null,
          prep_time_minutes: recipe.prepTimeMinutes ?? null,
          cook_time_minutes: recipe.cookTimeMinutes ?? null,
          storage_instructions: recipe.storageInstructions ?? null,
          reheating_instructions: recipe.reheatingInstructions ?? null,
          cheap_tips: recipe.cheapTips,
          substitutions: recipe.substitutions,
          crispiness_level: recipe.crispinessLevel ?? null,
          air_fryer_time_minutes: recipe.airFryerTimeMinutes ?? null,
          air_fryer_temperature_f: recipe.airFryerTemperatureF ?? null,
          variant_group: recipe.variantGroup ?? null,
          variant_type: recipe.variantType ?? null,
          dorm_friendly: recipe.dormFriendly ?? null,
          meal_prep_friendly: recipe.mealPrepFriendly ?? null,
          why_cheap: recipe.whyCheap ?? null,
          healthier_tips: recipe.healthierTips,
          batch_prep_tips: recipe.batchPrepTips,
          optional_add_ins: recipe.optionalAddIns,
          difficulty: recipe.difficulty ?? null,
          dish_types: recipe.dishTypes,
          dietary_tags: recipe.dietaryTags,
          hashtags: recipe.hashtags,
          default_servings: recipe.defaultServings,
          status: recipe.status,
          sort_order: recipe.sortOrder,
          source_url: recipe.sourceUrl ?? null,
          published_at: recipe.status === 'published' ? new Date().toISOString() : null,
        },
        { onConflict: 'external_id' },
      )
      .select('id')
      .single();
    if (error || !savedRecipe) {
      throw new Error(`${recipe.externalId}: ${error?.message ?? 'Speichern fehlgeschlagen'}`);
    }
    const recipeId = savedRecipe.id as string;
    for (const table of [
      'catalog_recipe_step_ingredients',
      'catalog_recipe_step_images',
      'catalog_recipe_images',
      'catalog_recipe_steps',
      'catalog_recipe_component_items',
      'catalog_recipe_components',
    ]) {
      const result = await db.from(table).delete().eq('recipe_id', recipeId);
      if (result.error) throw new Error(`${recipe.externalId}: ${result.error.message}`);
    }
    const components = new Map<string, string>();
    for (const component of recipe.components) {
      const { data, error: componentError } = await db
        .from('catalog_recipe_components')
        .insert({
          recipe_id: recipeId,
          name: component.name,
          serving_grams: component.servingGrams ?? null,
          position: component.position,
        })
        .select('id')
        .single();
      if (componentError || !data) {
        throw new Error(
          `${recipe.externalId}/${component.key}: ${componentError?.message ?? 'Gruppe fehlgeschlagen'}`,
        );
      }
      components.set(component.key, data.id as string);
    }
    const items = new Map<string, string>();
    for (const component of recipe.components) {
      for (const item of component.items) {
        const { data, error: itemError } = await db
          .from('catalog_recipe_component_items')
          .insert({
            component_id: components.get(component.key),
            recipe_id: recipeId,
            product_id: item.productId ?? null,
            sub_component_id: item.subComponentKey
              ? components.get(item.subComponentKey)
              : null,
            ingredient_name: item.ingredientName ?? null,
            grams: item.grams,
            quantity: item.quantity ?? null,
            unit: item.unit,
            optional: item.optional,
            note: item.source_note ?? null,
            position: item.position,
          })
          .select('id')
          .single();
        if (itemError || !data) {
          throw new Error(
            `${recipe.externalId}/${item.key}: ${itemError?.message ?? 'Zutat fehlgeschlagen'}`,
          );
        }
        items.set(item.key, data.id as string);
      }
    }
    for (const step of recipe.steps) {
      const { data, error: stepError } = await db
        .from('catalog_recipe_steps')
        .insert({
          recipe_id: recipeId,
          position: step.position,
          text: step.text,
          timer_minutes: step.timerMinutes ?? null,
        })
        .select('id')
        .single();
      if (stepError || !data) {
        throw new Error(
          `${recipe.externalId}/Schritt ${step.position}: ${stepError?.message ?? 'Schritt fehlgeschlagen'}`,
        );
      }
      const links = step.ingredientKeys.flatMap((key, position) =>
        items.has(key)
          ? [{ step_id: data.id, item_id: items.get(key), recipe_id: recipeId, position }]
          : [],
      );
      if (links.length) {
        const { error: linkError } = await db
          .from('catalog_recipe_step_ingredients')
          .insert(links);
        if (linkError) throw new Error(linkError.message);
      }
    }
    if (recipe.cover) {
      const storagePath = `${recipe.slug}/cover${path.extname(recipe.cover)}`;
      const bytes = await Bun.file(path.resolve(assetRoot, recipe.cover)).arrayBuffer();
      const { error: uploadError } = await db.storage
        .from('recipe-catalog')
        .upload(storagePath, bytes, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`${recipe.externalId}/Cover: ${uploadError.message}`);
      const { error: imageError } = await db.from('catalog_recipe_images').insert({
        recipe_id: recipeId,
        storage_path: storagePath,
        position: 0,
      });
      if (imageError) throw new Error(imageError.message);
    }
    if (recipe.images.length) {
      const imageRows = await Promise.all(
        recipe.images.map(async (image) => {
          let storagePath = image.storagePath ?? null;
          if (image.localPath) {
            storagePath ??= `waivy/${recipe.slug}${path.extname(image.localPath).toLowerCase() || '.jpg'}`;
            const localFile = Bun.file(path.resolve(assetRoot, image.localPath));
            if (!(await localFile.exists())) {
              throw new Error(`${recipe.externalId}/Bilddatei fehlt: ${image.localPath}`);
            }
            const { error: uploadError } = await db.storage
              .from('recipe-catalog')
              .upload(storagePath, await localFile.arrayBuffer(), {
                upsert: true,
                contentType: imageContentType(image.localPath),
              });
            if (uploadError) {
              throw new Error(`${recipe.externalId}/Bildupload: ${uploadError.message}`);
            }
          }
          return {
          recipe_id: recipeId,
          storage_path: storagePath,
          source_url: image.sourceUrl ?? null,
          source_page_url: image.sourcePageUrl ?? null,
          source_name: image.sourceName ?? null,
          license: image.license ?? null,
          attribution_required: image.attributionRequired,
          attribution_text: image.attributionText ?? null,
          verified_match: image.verifiedMatch,
          alt_text: image.altText ?? null,
          position: image.position,
          };
        }),
      );
      const { error: imageError } = await db
        .from('catalog_recipe_images')
        .insert(imageRows);
      if (imageError) throw new Error(imageError.message);
    }
    for (const [stepIndex, step] of recipe.steps.entries()) {
      const stepRow = await db
        .from('catalog_recipe_steps')
        .select('id')
        .eq('recipe_id', recipeId)
        .eq('position', step.position)
        .single();
      for (const [position, image] of step.images.entries()) {
        const storagePath = `${recipe.slug}/step-${stepIndex + 1}-${position + 1}${path.extname(image)}`;
        const bytes = await Bun.file(path.resolve(assetRoot, image)).arrayBuffer();
        const { error: uploadError } = await db.storage
          .from('recipe-catalog')
          .upload(storagePath, bytes, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) throw new Error(`${recipe.externalId}/Schrittbild: ${uploadError.message}`);
        const { error: imageError } = await db.from('catalog_recipe_step_images').insert({
          step_id: stepRow.data?.id,
          recipe_id: recipeId,
          storage_path: storagePath,
          position,
        });
        if (imageError) throw new Error(imageError.message);
      }
    }
    report.push({externalId:recipe.externalId,status:recipe.status});
    onProgress?.({ completed: index + 1, total: batch.recipes.length, current: recipe.title });
  }
  return report;
}

type ImportJob = { id: string; status: 'running' | 'completed' | 'failed'; completed: number; total: number; current: string; result?: unknown; error?: string };
const jobs = new Map<string, ImportJob>();
const server = Bun.serve({
  port: PORT,
  idleTimeout: 120,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/import-templates') {
      const id = crypto.randomUUID();
      const job: ImportJob = { id, status: 'running', completed: 0, total: 0, current: '' };
      jobs.set(id, job);
      console.log(`[${id}] Template-Import gestartet`);
      void (async () => {
        try {
          const db = createClient(required('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), { auth: { autoRefreshToken: false, persistSession: false } });
          job.result = await importLegacyTemplates(db, (progress) => {
            Object.assign(job, progress);
            if (progress.current) console.log(`[${id}] ${progress.completed}/${progress.total}: ${progress.current}`);
          });
          job.status = 'completed';
          console.log(`[${id}] Template-Import abgeschlossen (${job.completed}/${job.total})`);
        } catch (error) {
          job.status = 'failed';
          job.error = errorMessage(error);
          console.error(`[${id}] Template-Import fehlgeschlagen: ${job.error}`);
        }
      })();
      return Response.json({ ok: true, jobId: id }, { status: 202 });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/import-templates/')) {
      const job = jobs.get(url.pathname.split('/').pop() ?? '');
      if (!job) return Response.json({ ok: false, error: 'Import-Job nicht gefunden' }, { status: 404 });
      return Response.json(job);
    }

    if (request.method === 'POST' && (url.pathname === '/api/validate' || url.pathname === '/api/import')) {
      try {
        const parsed = batchSchema.parse(await request.json());
        if (url.pathname === '/api/validate') {
          console.log(`Batch validiert: ${parsed.recipes.length} Rezept(e)`);
          return Response.json({ valid: true, recipes: parsed.recipes.length });
        }

        const id = crypto.randomUUID();
        const job: ImportJob = { id, status: 'running', completed: 0, total: parsed.recipes.length, current: '' };
        jobs.set(id, job);
        console.log(`[${id}] Batch-Import gestartet (${job.total} Rezept(e))`);
        void (async () => {
          try {
            const result = await importBatch(parsed, url.searchParams.get('assetRoot') ?? process.cwd(), (progress) => {
              Object.assign(job, progress);
              if (progress.current) console.log(`[${id}] ${progress.completed}/${progress.total}: ${progress.current}`);
            });
            job.result = result;
            job.status = 'completed';
            console.log(`[${id}] Batch-Import abgeschlossen (${job.completed}/${job.total})`);
          } catch (error) {
            job.status = 'failed';
            job.error = errorMessage(error);
            console.error(`[${id}] Batch-Import fehlgeschlagen: ${job.error}`);
          }
        })();
        return Response.json({ ok: true, jobId: id }, { status: 202 });
      } catch (error) {
        console.error(`Batch-Request abgelehnt: ${errorMessage(error)}`);
        return Response.json({ ok: false, error: errorMessage(error) }, { status: 400 });
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/import/')) {
      const job = jobs.get(url.pathname.split('/').pop() ?? '');
      if (!job) return Response.json({ ok: false, error: 'Import-Job nicht gefunden' }, { status: 404 });
      return Response.json(job);
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(await readFile(path.join(import.meta.dir, 'index.html')), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response('Nicht gefunden', { status: 404 });
  },
});
console.log(`Recipe Catalog Batch Import: http://localhost:${server.port}`);
