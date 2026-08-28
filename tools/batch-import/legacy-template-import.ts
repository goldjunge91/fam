import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

type Template = {
  id: string;
  title: string;
  instructions: string | null;
  cover_image_path: string | null;
  cook_time_minutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  dish_types: string[];
  dietary_tags: string[];
  hashtags: string[];
  default_servings: number;
  sort_order: number;
};
type Component = { id: string; template_id: string; name: string; serving_grams: number | null };
type Item = { id: string; component_id: string; template_id: string; product_id: string | null; sub_component_id: string | null; grams: number; quantity: number | null; unit: string };
type Step = { id: string; template_id: string; position: number; text: string };

function slugify(title: string, id: string) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'rezept';
  return `${base}-${id.slice(0, 8)}`;
}

async function ensureBucket(db: SupabaseClient) {
  const { error } = await db.storage.createBucket('recipe-catalog', { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

export async function importLegacyTemplates(db: SupabaseClient, onProgress?: (progress: { completed: number; total: number; current: string }) => void) {
  await ensureBucket(db);
  const [{ data: templates, error: templateError }, { data: components, error: componentError }, { data: items, error: itemError }, { data: steps, error: stepError }] = await Promise.all([
    db.from('recipe_templates').select('id,title,instructions,cover_image_path,cook_time_minutes,difficulty,dish_types,dietary_tags,hashtags,default_servings,sort_order').order('sort_order'),
    db.from('recipe_template_components').select('id,template_id,name,serving_grams').order('created_at'),
    db.from('recipe_template_items').select('id,component_id,template_id,product_id,sub_component_id,grams,quantity,unit').order('created_at'),
    db.from('recipe_template_steps').select('id,template_id,position,text').order('position'),
  ]);
  if (templateError) throw templateError;
  if (componentError) throw componentError;
  if (itemError) throw itemError;
  if (stepError) throw stepError;

  const componentRows = (components ?? []) as Component[];
  const itemRows = (items ?? []) as Item[];
  const stepRows = (steps ?? []) as Step[];
  const report: Array<{ templateId: string; slug: string; title: string; coverCopied: boolean }> = [];

  const templateList = (templates ?? []) as Template[];
  onProgress?.({ completed: 0, total: templateList.length, current: '' });
  for (const [index, template] of templateList.entries()) {
    const slug = slugify(template.title, template.id);
    const { data: recipe, error } = await db.from('catalog_recipes').upsert({
      external_id: `template:${template.id}`,
      slug,
      title: template.title,
      instructions: template.instructions,
      cook_time_minutes: template.cook_time_minutes,
      difficulty: template.difficulty,
      dish_types: template.dish_types,
      dietary_tags: template.dietary_tags,
      hashtags: template.hashtags,
      default_servings: template.default_servings,
      status: 'published',
      sort_order: template.sort_order,
      published_at: new Date().toISOString(),
    }, { onConflict: 'external_id' }).select('id').single();
    if (error || !recipe) throw new Error(`${template.id}: ${error?.message ?? 'Katalogrezept konnte nicht angelegt werden'}`);
    const recipeId = recipe.id as string;
    for (const table of ['catalog_recipe_step_ingredients', 'catalog_recipe_step_images', 'catalog_recipe_images', 'catalog_recipe_steps', 'catalog_recipe_component_items', 'catalog_recipe_components']) {
      const result = await db.from(table).delete().eq('recipe_id', recipeId);
      if (result.error) throw result.error;
    }

    const componentsById = new Map<string, string>();
    for (const component of componentRows.filter((row) => row.template_id === template.id)) {
      const { data, error: insertError } = await db.from('catalog_recipe_components').insert({ recipe_id: recipeId, name: component.name, serving_grams: component.serving_grams, position: componentsById.size }).select('id').single();
      if (insertError || !data) throw insertError ?? new Error('Komponente konnte nicht angelegt werden');
      componentsById.set(component.id, data.id as string);
    }
    const itemIds = new Map<string, string>();
    for (const item of itemRows.filter((row) => row.template_id === template.id)) {
      const { data, error: insertError } = await db.from('catalog_recipe_component_items').insert({ component_id: componentsById.get(item.component_id), recipe_id: recipeId, product_id: item.product_id, sub_component_id: item.sub_component_id ? componentsById.get(item.sub_component_id) : null, grams: item.grams, quantity: item.quantity, unit: item.unit, position: itemIds.size }).select('id').single();
      if (insertError || !data) throw insertError ?? new Error('Zutat konnte nicht angelegt werden');
      itemIds.set(item.id, data.id as string);
    }
    for (const step of stepRows.filter((row) => row.template_id === template.id)) {
      const { error: insertError } = await db.from('catalog_recipe_steps').insert({ recipe_id: recipeId, position: step.position, text: step.text });
      if (insertError) throw insertError;
    }

    let coverCopied = false;
    if (template.cover_image_path) {
      const source = await db.storage.from('recipe-covers').download(template.cover_image_path);
      if (source.error) throw source.error;
      const storagePath = `${slug}/cover${path.extname(template.cover_image_path) || '.jpg'}`;
      const upload = await db.storage.from('recipe-catalog').upload(storagePath, source.data, { upsert: true, contentType: source.data.type || 'image/jpeg' });
      if (upload.error) throw upload.error;
      const image = await db.from('catalog_recipe_images').insert({ recipe_id: recipeId, storage_path: storagePath, position: 0 });
      if (image.error) throw image.error;
      coverCopied = true;
    }
    report.push({ templateId: template.id, slug, title: template.title, coverCopied });
    onProgress?.({ completed: index + 1, total: templateList.length, current: template.title });
  }
  return report;
}
