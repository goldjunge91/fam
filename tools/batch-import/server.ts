#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { importLegacyTemplates } from './legacy-template-import';

const PORT = Number(process.env.RECIPE_CATALOG_PORT ?? 8787);
const item = z.object({ key: z.string().min(1), ingredientName: z.string().min(1).optional(), productId: z.string().uuid().optional(), subComponentKey: z.string().min(1).optional(), grams: z.number().positive(), quantity: z.number().positive().optional(), unit: z.enum(['g','kg','ml','l','piece','package','portion']).default('g'), position: z.number().int().nonnegative().default(0) }).refine(v => Number(Boolean(v.ingredientName)) + Number(Boolean(v.productId)) + Number(Boolean(v.subComponentKey)) === 1, 'Genau eine Zutat, productId oder Untergruppe angeben.');
const batchSchema = z.object({ schemaVersion: z.literal(1), recipes: z.array(z.object({ externalId:z.string().min(1), slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title:z.string().min(1).max(200), instructions:z.string().nullable().optional(), cookTimeMinutes:z.number().int().positive().nullable().optional(), difficulty:z.enum(['easy','medium','hard']).nullable().optional(), dishTypes:z.array(z.string()).default([]), dietaryTags:z.array(z.string()).default([]), hashtags:z.array(z.string()).default([]), defaultServings:z.number().int().positive().default(1), status:z.enum(['draft','published','archived']).default('draft'), sortOrder:z.number().int().default(0), sourceUrl:z.string().url().nullable().optional(), cover:z.string().optional(), components:z.array(z.object({key:z.string().min(1),name:z.string().min(1).max(120),servingGrams:z.number().positive().nullable().optional(),position:z.number().int().nonnegative().default(0),items:z.array(item).default([])})).default([]), steps:z.array(z.object({position:z.number().int().nonnegative(),text:z.string().min(1).max(2000),timerMinutes:z.number().int().positive().nullable().optional(),ingredientKeys:z.array(z.string()).default([]),images:z.array(z.string()).default([])})).default([]) })) }).superRefine((batch, ctx) => { for (const field of ['externalId', 'slug'] as const) { const seen = new Map<string, number>(); batch.recipes.forEach((recipe, index) => { const value = recipe[field]; const previous = seen.get(value); if (previous !== undefined) { ctx.addIssue({ code: 'custom', path: ['recipes', index, field], message: `${field} doppelt (bereits in Rezept ${previous + 1})` }); } else seen.set(value, index); }); } });
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

async function importBatch(batch: Batch, assetRoot: string) {
  const db = createClient(required('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'), { auth:{autoRefreshToken:false,persistSession:false} });
  const report = [];
  for (const recipe of batch.recipes) {
    const {data:r,error} = await db.from('catalog_recipes').upsert({external_id:recipe.externalId,slug:recipe.slug,title:recipe.title,instructions:recipe.instructions??null,cook_time_minutes:recipe.cookTimeMinutes??null,difficulty:recipe.difficulty??null,dish_types:recipe.dishTypes,dietary_tags:recipe.dietaryTags,hashtags:recipe.hashtags,default_servings:recipe.defaultServings,status:recipe.status,sort_order:recipe.sortOrder,source_url:recipe.sourceUrl??null,published_at:recipe.status==='published'?new Date().toISOString():null},{onConflict:'external_id'}).select('id').single();
    if(error||!r) throw new Error(`${recipe.externalId}: ${error?.message??'Speichern fehlgeschlagen'}`);
    const recipeId=r.id as string;
    for(const table of ['catalog_recipe_step_ingredients','catalog_recipe_step_images','catalog_recipe_images','catalog_recipe_steps','catalog_recipe_component_items','catalog_recipe_components']) { const result=await db.from(table).delete().eq('recipe_id',recipeId); if(result.error) throw new Error(`${recipe.externalId}: ${result.error.message}`); }
    const components=new Map<string,string>();
    for(const c of recipe.components){const {data,error:e}=await db.from('catalog_recipe_components').insert({recipe_id:recipeId,name:c.name,serving_grams:c.servingGrams??null,position:c.position}).select('id').single();if(e||!data)throw new Error(`${recipe.externalId}/${c.key}: ${e?.message??'Gruppe fehlgeschlagen'}`);components.set(c.key,data.id as string);}
    const items=new Map<string,string>();
    for(const c of recipe.components)for(const i of c.items){const {data,error:e}=await db.from('catalog_recipe_component_items').insert({component_id:components.get(c.key),recipe_id:recipeId,product_id:i.productId??null,sub_component_id:i.subComponentKey?components.get(i.subComponentKey):null,ingredient_name:i.ingredientName??null,grams:i.grams,quantity:i.quantity??null,unit:i.unit,position:i.position}).select('id').single();if(e||!data)throw new Error(`${recipe.externalId}/${i.key}: ${e?.message??'Zutat fehlgeschlagen'}`);items.set(i.key,data.id as string);}
    for(const s of recipe.steps){const {data,error:e}=await db.from('catalog_recipe_steps').insert({recipe_id:recipeId,position:s.position,text:s.text,timer_minutes:s.timerMinutes??null}).select('id').single();if(e||!data)throw new Error(`${recipe.externalId}/Schritt ${s.position}: ${e?.message??'Schritt fehlgeschlagen'}`);const links=s.ingredientKeys.flatMap((key,position)=>items.has(key)?[{step_id:data.id,item_id:items.get(key),recipe_id:recipeId,position}]:[]);if(links.length){const {error:le}=await db.from('catalog_recipe_step_ingredients').insert(links);if(le)throw new Error(le.message);}}
    if(recipe.cover){const storagePath=`${recipe.slug}/cover${path.extname(recipe.cover)}`;const bytes=await Bun.file(path.resolve(assetRoot,recipe.cover)).arrayBuffer();const {error:e}=await db.storage.from('recipe-catalog').upload(storagePath,bytes,{upsert:true,contentType:'image/jpeg'});if(e)throw new Error(`${recipe.externalId}/Cover: ${e.message}`);const {error:ie}=await db.from('catalog_recipe_images').insert({recipe_id:recipeId,storage_path:storagePath,position:0});if(ie)throw new Error(ie.message);}
    for(const [stepIndex,s] of recipe.steps.entries()){const stepRow=await db.from('catalog_recipe_steps').select('id').eq('recipe_id',recipeId).eq('position',s.position).single();for(const [position,image] of s.images.entries()){const storagePath=`${recipe.slug}/step-${stepIndex+1}-${position+1}${path.extname(image)}`;const bytes=await Bun.file(path.resolve(assetRoot,image)).arrayBuffer();const {error:e}=await db.storage.from('recipe-catalog').upload(storagePath,bytes,{upsert:true,contentType:'image/jpeg'});if(e)throw new Error(`${recipe.externalId}/Schrittbild: ${e.message}`);const {error:ie}=await db.from('catalog_recipe_step_images').insert({step_id:stepRow.data?.id,recipe_id:recipeId,storage_path:storagePath,position});if(ie)throw new Error(ie.message);}}
    report.push({externalId:recipe.externalId,status:recipe.status});
  }
  return report;
}

type ImportJob = { id: string; status: 'running' | 'completed' | 'failed'; completed: number; total: number; current: string; result?: unknown; error?: string };
const jobs = new Map<string, ImportJob>();
const server=Bun.serve({port:PORT,idleTimeout:120,async fetch(request){const url=new URL(request.url);if(request.method==='POST'&&url.pathname==='/api/import-templates'){const id=crypto.randomUUID();const job:ImportJob={id,status:'running',completed:0,total:0,current:''};jobs.set(id,job);void (async()=>{try{const db=createClient(required('SUPABASE_URL','EXPO_PUBLIC_SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'),{auth:{autoRefreshToken:false,persistSession:false}});job.result=await importLegacyTemplates(db,(progress)=>Object.assign(job,progress));job.status='completed';}catch(error){job.status='failed';job.error=errorMessage(error);}})();return Response.json({ok:true,jobId:id},{status:202});}if(request.method==='GET'&&url.pathname.startsWith('/api/import-templates/')){const job=jobs.get(url.pathname.split('/').pop()??'');if(!job)return Response.json({ok:false,error:'Import-Job nicht gefunden'},{status:404});return Response.json(job);}if(request.method==='POST'&&(url.pathname==='/api/validate'||url.pathname==='/api/import')){try{const parsed=batchSchema.parse(await request.json());if(url.pathname==='/api/validate')return Response.json({valid:true,recipes:parsed.recipes.length});return Response.json({ok:true,result:await importBatch(parsed,url.searchParams.get('assetRoot')??process.cwd())});}catch(error){return Response.json({ok:false,error:errorMessage(error)},{status:400});}}if(url.pathname==='/'||url.pathname==='/index.html')return new Response(await readFile(path.join(import.meta.dir,'index.html')),{headers:{'content-type':'text/html; charset=utf-8'}});return new Response('Nicht gefunden',{status:404});}});
console.log(`Recipe Catalog Batch Import: http://localhost:${server.port}`);
