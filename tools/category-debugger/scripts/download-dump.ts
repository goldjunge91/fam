#!/usr/bin/env bun
/** Laedt den neuesten OFF-Dump fuer die direkte Verwendung durch sql.js. */

import fs from 'node:fs';
import path from 'node:path';

const REPO = 'goldjunge91/fam';
const OUT_PATH = path.join(import.meta.dirname, '..', 'public', 'off-dump.db');

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { tag_name?: string; assets?: ReleaseAsset[] };

async function main() {
  console.log(`Prüfe neuesten Dump-Release von ${REPO}...`);
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) {
    console.error(`GitHub-API antwortete mit ${res.status}. Kein Netz oder Rate-Limit erreicht?`);
    process.exit(1);
  }

  const release = (await res.json()) as Release;
  const asset = (release.assets ?? []).find((a) => a.name.toLowerCase().endsWith('.db'));
  if (!asset || !release.tag_name) {
    console.error('Kein .db-Asset im neuesten Release gefunden.');
    process.exit(1);
  }

  console.log(`Release ${release.tag_name}: lade ${asset.name}...`);
  const dbRes = await fetch(asset.browser_download_url);
  if (!dbRes.ok) {
    console.error(`Download fehlgeschlagen: ${dbRes.status}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const buffer = Buffer.from(await dbRes.arrayBuffer());
  fs.writeFileSync(OUT_PATH, buffer);

  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(1);
  console.log(`OK: ${OUT_PATH} (${sizeMB} MB, Release ${release.tag_name})`);
  console.log('Jetzt "bun run dev" starten.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
