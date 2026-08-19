import { readdir, readFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../src/lib/database.types';

const BUCKET = 'recipe-covers';
const EXPECTED_TEMPLATE_COUNT = 29;
const ASSET_DIRECTORY = new URL('../assets/rezepte/', import.meta.url);

function requireEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'SUPABASE_SECRET_KEY'): string {
  const value = process.env[name] || (name === 'SUPABASE_SECRET_KEY' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!value) throw new Error(`${name} fehlt in .env.`);
  return value;
}

function titleToFilename(title: string): string {
  return `${title
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.jpg`;
}

const supabase = createClient<Database>(
  requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SECRET_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: templates, error: templateError } = await supabase
  .from('recipe_templates')
  .select('id, title, cover_image_path')
  .order('sort_order');

if (templateError) throw templateError;
const templateRows = templates ?? [];

if (templateRows.length !== EXPECTED_TEMPLATE_COUNT) {
  throw new Error(
    `Erwartet wurden ${EXPECTED_TEMPLATE_COUNT} Templates, gefunden: ${templateRows.length}.`,
  );
}

const assetFiles = (await readdir(ASSET_DIRECTORY)).filter((name) => name.endsWith('.jpg'));
const expectedFiles = new Set(templateRows.map(({ title }) => titleToFilename(title)));
const missingFiles = [...expectedFiles].filter((name) => !assetFiles.includes(name));
const unusedFiles = assetFiles.filter((name) => !expectedFiles.has(name));

if (missingFiles.length > 0 || unusedFiles.length > 0) {
  throw new Error(
    `Asset-Zuordnung ist nicht vollstaendig. Fehlend: ${missingFiles.join(', ') || '-'}; ungenutzt: ${unusedFiles.join(', ') || '-'}.`,
  );
}

for (const template of templateRows) {
  const expectedPath = `templates/${template.id}.jpg`;
  const bytes = await readFile(new URL(titleToFilename(template.title), ASSET_DIRECTORY));
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(expectedPath, bytes, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw new Error(`${template.title}: ${uploadError.message}`);

  if (template.cover_image_path !== expectedPath) {
    const { error: updateError } = await supabase
      .from('recipe_templates')
      .update({ cover_image_path: expectedPath })
      .eq('id', template.id);

    if (updateError) throw new Error(`${template.title}: ${updateError.message}`);
  }

  console.log(`Hochgeladen: ${expectedPath}`);
}

console.log(`${templateRows.length} Template-Cover erfolgreich hochgeladen.`);
