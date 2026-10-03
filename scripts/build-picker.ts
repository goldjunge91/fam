#!/usr/bin/env bun

/**
 * build-picker.ts — Interaktiver iOS-Build-Assistent.
 *
 * Bietet alle iOS-Build-Varianten aus eas.json als Terminal-Menü an,
 * erklärt in einem Satz, wofür jede Variante gedacht ist, und kann
 * Store-Builds nach dem Bau automatisch zu TestFlight bzw. App Store
 * Connect hochladen (eas submit).
 *
 * Die reine Logik lebt in scripts/build-picker-logic.ts und wird in
 * test/build-picker.test.ts gegen eas.json abgeglichen.
 *
 * Verwendung:
 *   bun run ios:picker
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import {
  buildCommandArgs,
  findVariant,
  localOutputPath,
  menuOptions,
  submitCommandArgs,
  uploadQuestion,
} from './build-picker-logic';

const projectRoot = path.resolve(__dirname, '..');
const buildScript = path.join(projectRoot, 'scripts', 'eas-ios-build.sh');

interface CommandStep {
  command: string;
  args: string[];
}

function runStep(stepLabel: string, step: CommandStep): boolean {
  p.log.step(stepLabel);
  const result = spawnSync(step.command, step.args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    p.log.error(`${stepLabel} fehlgeschlagen (Exit-Code ${result.status ?? 'unbekannt'}).`);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  if (!fs.existsSync(buildScript)) {
    p.log.error(`Build-Script fehlt: ${buildScript}`);
    process.exit(1);
  }

  p.intro('fam iOS Build Picker');

  const selected = await p.select<string>({
    message: 'Welche Build-Variante?',
    options: menuOptions(),
  });
  if (p.isCancel(selected)) {
    p.cancel('Abgebrochen.');
    process.exit(0);
  }
  const variant = findVariant(selected);
  if (!variant) {
    p.log.error('Unbekanntes Profil.');
    process.exit(1);
  }

  let autoUpload = false;
  const question = uploadQuestion(variant);
  if (question) {
    const answer = await p.confirm({ message: question, initialValue: false });
    if (p.isCancel(answer)) {
      p.cancel('Abgebrochen.');
      process.exit(0);
    }
    autoUpload = answer;
  }

  const buildOk = runStep(
    `Build läuft: ${variant.easProfile} (${variant.local ? 'lokal' : 'Cloud'})`,
    buildCommandArgs(variant),
  );
  if (!buildOk) {
    p.outro('Build fehlgeschlagen — nichts hochgeladen.');
    process.exit(1);
  }

  if (!autoUpload || !variant.submitProfile) {
    p.outro(`Build fertig: ${variant.easProfile}.`);
    return;
  }

  if (variant.local) {
    const ipa = localOutputPath(variant);
    if (!fs.existsSync(ipa)) {
      p.log.error(`Erwartete .ipa nicht gefunden: ${ipa}`);
      p.outro('Upload übersprungen.');
      process.exit(1);
    }
    const submit = submitCommandArgs(variant, path.relative(projectRoot, ipa));
    if (!submit || !runStep(`Upload läuft: eas submit (${variant.submitProfile})`, submit)) {
      p.outro('Upload fehlgeschlagen — die .ipa liegt bereit zum erneuten Versuch.');
      process.exit(1);
    }
  } else {
    const submit = submitCommandArgs(variant, null);
    if (
      !submit ||
      !runStep(`Upload läuft: eas submit --latest (${variant.submitProfile})`, submit)
    ) {
      p.outro('Upload fehlgeschlagen.');
      process.exit(1);
    }
  }

  p.outro(`Fertig: ${variant.easProfile} gebaut und hochgeladen (${variant.submitProfile}).`);
}

await main();
