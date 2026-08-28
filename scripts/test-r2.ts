/**
 * scripts/test-r2.ts
 *
 * Test-Skript zur Überprüfung der Cloudflare R2 Konfiguration:
 * 1. Prüft Umgebungsvariablen (.env)
 * 2. Upload eines Test-Objekts via S3-API
 * 3. Lese-Test via S3-API
 * 4. Öffentlicher HTTP-Abruf-Test über R2_PUBLIC_URL (prüft Public Access & CORS)
 * 5. Automatisches Aufräumen des Test-Objekts
 *
 * Ausführen mit:
 *   bun run scripts/test-r2.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { S3Client } from 'bun';

// 1. Lokale .env Dateien laden
function loadEnv() {
  const envFiles = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env.development.local'),
  ];
  for (const file of envFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucketName = process.env.R2_BUCKET_NAME?.trim() || 'app-broschures';
const publicUrl = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, '');

async function runR2Test() {
  console.log('\n======================================================');
  console.log('  🧪 Cloudflare R2 Verbindungs- & Konfigurationstest');
  console.log('======================================================\n');

  // Schritt 1: Variablen-Check
  console.log('1️⃣  Prüfe Umgebungsvariablen...');
  const missing: string[] = [];
  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');

  if (missing.length > 0) {
    console.error(`❌ Fehlende Variablen in .env: ${missing.join(', ')}`);
    console.log('\nBitte trage folgende Werte in deine .env ein:');
    console.log('  R2_ACCOUNT_ID="deine_cloudflare_account_id"');
    console.log('  R2_ACCESS_KEY_ID="dein_r2_access_key_id"');
    console.log('  R2_SECRET_ACCESS_KEY="dein_r2_secret_access_key"');
    console.log('  R2_BUCKET_NAME="app-broschures"');
    console.log('  R2_PUBLIC_URL="https://pub-xxxx.r2.dev" (oder Custom Domain)\n');
    process.exit(1);
  }

  console.log(`  ✅ Account ID:   ${accountId?.slice(0, 6)}...${accountId?.slice(-4)}`);
  console.log(`  ✅ Access Key:   ${accessKeyId?.slice(0, 6)}...`);
  console.log(`  ✅ Bucket Name:  ${bucketName}`);
  console.log(`  ✅ Public URL:   ${publicUrl || '⚠️ Nicht gesetzt (Public HTTP Test wird übersprungen)'}\n`);

  // Schritt 2: S3 Client initialisieren
  console.log('2️⃣  Initialisiere S3 Client...');
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const s3 = new S3Client({
    accessKeyId,
    secretAccessKey,
    bucket: bucketName,
    endpoint,
  });
  console.log(`  ✅ Endpoint: ${endpoint}\n`);

  const testKey = `test/r2-connection-check-${Date.now()}.txt`;
  const testPayload = JSON.stringify({
    message: 'Hello from Haushaltsapp R2 Test!',
    timestamp: new Date().toISOString(),
    bucket: bucketName,
  }, null, 2);

  // Schritt 3: Upload Test
  console.log(`3️⃣  Lade Test-Datei hoch (${testKey})...`);
  try {
    const s3File = s3.file(testKey);
    await s3File.write(testPayload, { type: 'application/json' });
    console.log('  ✅ Upload erfolgreich!\n');
  } catch (err) {
    console.error('  ❌ Upload fehlgeschlagen:', err instanceof Error ? err.message : err);
    console.error('  👉 Prüfe, ob Access Key, Secret Key und Bucket-Name exakt stimmen.');
    process.exit(1);
  }

  // Schritt 4: Lese-Test via S3 API
  console.log('4️⃣  Lese Test-Datei via S3 API...');
  try {
    const s3File = s3.file(testKey);
    const downloadedContent = await s3File.text();
    const parsed = JSON.parse(downloadedContent);
    console.log(`  ✅ Datei erfolgreich gelesen: "${parsed.message}"\n`);
  } catch (err) {
    console.error('  ❌ Lesen via S3 fehlgeschlagen:', err instanceof Error ? err.message : err);
  }

  // Schritt 5: Öffentlicher HTTP-Zugriffstest (Public URL / CDN / CORS)
  if (publicUrl) {
    console.log('5️⃣  Prüfe öffentlichen HTTP-Zugriff (Public URL / App / Tools)...');
    const directHttpUrl = `${publicUrl}/${testKey}`;
    console.log(`  🌐 Anfrage an: ${directHttpUrl}`);

    try {
      const response = await fetch(directHttpUrl, {
        headers: {
          Origin: 'http://localhost:3333', // Testet CORS
        },
      });

      if (response.ok) {
        const corsHeader = response.headers.get('access-control-allow-origin');
        const cacheHeader = response.headers.get('cache-control');
        console.log(`  ✅ HTTP Status: ${response.status} ${response.statusText}`);
        console.log(`  ✅ CORS Header (Access-Control-Allow-Origin): ${corsHeader || 'nicht gesetzt (prüfe CORS-Policy im Bucket)'}`);
        console.log(`  ✅ Cache-Control: ${cacheHeader || 'kein Header'}`);
        console.log('  🎉 Öffentlicher Zugriff für App & Tools funktioniert einwandfrei!\n');
      } else {
        console.warn(`  ⚠️ HTTP Status ${response.status}: Öffentlicher Zugriff noch nicht aktiv oder Domain falsch.`);
        console.warn('  👉 Prüfe im Dashboard: Settings -> Public access (Allow) oder Custom Domain.');
      }
    } catch (err) {
      console.warn('  ⚠️ Fehler beim HTTP-Fetch:', err instanceof Error ? err.message : err);
    }
  }

  // Schritt 6: Aufräumen
  console.log('6️⃣  Räume Test-Datei auf...');
  try {
    const s3File = s3.file(testKey);
    await s3File.delete();
    console.log('  ✅ Test-Datei gelöscht.\n');
  } catch (err) {
    console.warn('  ⚠️ Konnte Test-Datei nicht löschen:', err instanceof Error ? err.message : err);
  }

  console.log('======================================================');
  console.log('  🎉 R2 Bucket ist bereit für Prospekte & App!');
  console.log('======================================================\n');
}

runR2Test().catch((err) => {
  console.error('💥 Unerwarteter Fehler:', err);
  process.exit(1);
});
