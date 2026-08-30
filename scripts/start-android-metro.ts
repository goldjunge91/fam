#!/usr/bin/env bun
/**
 * Separater Metro-Start für den Android-Dev-Client.
 *
 * Verwendung:
 *   bun run metro:android
 *   bun run metro:android:development
 *   bun run metro:android -- --clear
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const args = process.argv.slice(2);
let envFile = '.env.local';
const expoArgs: string[] = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--env' || arg === '-e') {
    envFile = args[index + 1] ?? envFile;
    index += 1;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Verwendung:
  bun run metro:android
  bun run metro:android:development
  bun run metro:android -- --clear

Optionen:
  --env, -e <datei>  Env-Datei (Standard: .env.local)
  --help, -h         Diese Hilfe anzeigen

Weitere Argumente werden an Expo Metro weitergereicht.
`);
    process.exit(0);
  } else {
    expoArgs.push(arg);
  }
}

const envPath = path.resolve(projectRoot, envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Env-Datei nicht gefunden: ${envPath}`);
  process.exit(1);
}

process.env.EXPO_NO_DOTENV = '1';
Object.assign(process.env, dotenv.parse(fs.readFileSync(envPath)));

console.log(`Android Metro startet mit ${envFile}`);
console.log('Dev-Client wird erwartet. Für eine Release-APK ist Metro nicht erforderlich.');

const command = process.platform === 'win32' ? 'bunx.cmd' : 'bunx';
const child = spawn(command, ['expo', 'start', '--dev-client', ...expoArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Android Metro konnte nicht gestartet werden: ${error.message}`);
  process.exit(1);
});
