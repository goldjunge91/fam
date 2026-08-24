#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CLASSIFIER_VERSION } from '../../../src/features/shopping-list/classification/classifier-version';
import {
  classifyCategory,
  explainCategory,
} from '../../../src/features/shopping-list/classification/shopping-category-classifier';
import { canonicalProductSnapshot, parseCategoryTags, splitForHash } from '../src/evaluation/product';

type DumpRow = {
  product_rowid: number;
  code: string | null;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  categories_tags: string | null;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function validBarcode(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return /^[0-9]{6,32}$/.test(normalized) ? normalized : null;
}

export function prepareDump(dumpPath: string): void {
  if (!fs.existsSync(dumpPath)) throw new Error(`Dump nicht gefunden: ${dumpPath}`);
  console.log('Erzeuge Evaluation-Index mit produktivem Classifier...');
  const db = new Database(dumpPath);
  const columns = db.query('pragma table_info(products)').all() as { name: string }[];
  const hasCategoryTags = columns.some((column) => column.name === 'categories_tags');

  db.exec(`
    drop table if exists category_evaluation_candidates;
    drop table if exists category_evaluation_metadata;

    create table category_evaluation_candidates (
      product_rowid integer primary key,
      product_key text not null,
      snapshot_hash text not null,
      dataset_split text not null,
      sample_hash integer not null,
      combined_category text,
      combined_source text,
      off_category text,
      name_category text,
      conflict_reason text,
      is_disagreement integer not null,
      is_tie integer not null,
      is_no_signal integer not null
    );

    create table category_evaluation_metadata (
      key text primary key,
      value text not null
    );
  `);

  const select = db.query<DumpRow, []>(
    hasCategoryTags
      ? `select rowid as product_rowid, code, product_name, brand, quantity, categories_tags
           from products where product_name is not null and length(trim(product_name)) > 0`
      : `select rowid as product_rowid, code, product_name, brand, quantity, null as categories_tags
           from products where product_name is not null and length(trim(product_name)) > 0`,
  );
  const insert = db.prepare(`
    insert into category_evaluation_candidates (
      product_rowid, product_key, snapshot_hash, dataset_split, sample_hash,
      combined_category, combined_source, off_category, name_category, conflict_reason,
      is_disagreement, is_tie, is_no_signal
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const indexRows = db.transaction((rows: IterableIterator<DumpRow>) => {
    let count = 0;
    for (const row of rows) {
      const tags = parseCategoryTags(row.categories_tags);
      const trace = explainCategory({ name: row.product_name, categoryTags: tags, source: 'dump' });
      const offCategory = classifyCategory({ name: '', categoryTags: tags }).categoryId;
      const nameCategory = classifyCategory({ name: row.product_name, categoryTags: [] }).categoryId;
      const snapshotHash = sha256(canonicalProductSnapshot(row));
      const barcode = validBarcode(row.code);
      const productKey = barcode ? `barcode:${barcode}` : `content:${snapshotHash}`;
      const keyHash = sha256(productKey);
      const isDisagreement = offCategory !== null && nameCategory !== null && offCategory !== nameCategory;
      const isTie = trace.winner.categoryId === null && trace.conflictReason !== null;
      const isNoSignal = trace.winner.categoryId === null && trace.conflictReason === null;
      insert.run(
        row.product_rowid,
        productKey,
        snapshotHash,
        splitForHash(keyHash),
        Number.parseInt(keyHash.slice(0, 8), 16),
        trace.winner.categoryId,
        trace.winner.source,
        offCategory,
        nameCategory,
        trace.conflictReason,
        isDisagreement ? 1 : 0,
        isTie ? 1 : 0,
        isNoSignal ? 1 : 0,
      );
      count++;
      if (count % 50_000 === 0) console.log(`  ${count.toLocaleString('de-DE')} Produkte indexiert`);
    }
    return count;
  })(select.iterate());

  db.exec(`
    create unique index category_evaluation_candidates_product_key_idx
      on category_evaluation_candidates (product_key);
    create index category_evaluation_candidates_disagreement_idx
      on category_evaluation_candidates (is_disagreement, sample_hash);
    create index category_evaluation_candidates_tie_idx
      on category_evaluation_candidates (is_tie, sample_hash);
    create index category_evaluation_candidates_no_signal_idx
      on category_evaluation_candidates (is_no_signal, sample_hash);
    create index category_evaluation_candidates_stratified_idx
      on category_evaluation_candidates (combined_category, combined_source, sample_hash);
  `);
  const metadata = db.prepare('insert into category_evaluation_metadata (key, value) values (?, ?)');
  metadata.run('classifier_version', CLASSIFIER_VERSION);
  metadata.run('indexed_product_count', String(indexRows));
  metadata.run('created_at', new Date().toISOString());
  db.exec('pragma optimize');
  db.close();
  console.log(`Evaluation-Index bereit: ${indexRows.toLocaleString('de-DE')} Produkte.`);
}

if (import.meta.main) {
  const dumpPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(import.meta.dirname, '..', 'public', 'off-dump.db');
  prepareDump(dumpPath);
}

