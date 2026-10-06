import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BUILD_CHOICES,
  buildChoiceOptions,
  buildLocationOptions,
  buildLogPath,
  easCleanCloneStep,
  easLocalBuildEnv,
  easLocalBuildEnvVars,
  findBuildChoice,
  formatDuration,
  parseAvailableIosSimulators,
  parseShowBuildSettings,
  profileFor,
  simulatorBootStep,
  simulatorInstallStep,
  simulatorLaunchStep,
  simulatorSteps,
  storeSteps,
  submitMethodOptions,
} from '../scripts/build-picker-logic';

describe('Menue: nach Build-Ziel', () => {
  it('bietet die vier Ziele statt einer Profil-Auswahl', () => {
    expect(BUILD_CHOICES.map((choice) => choice.id)).toEqual([
      'testflight',
      'app-store',
      'simulator-build-only',
      'simulator-install',
    ]);
  });

  it('laesst den Build-Ort erst nach der Zielauswahl waehlen', () => {
    expect(buildLocationOptions().map((option) => option.value)).toEqual(['cloud', 'local']);
  });

  it('liefert fuer jede Menue-Option einen aufloesbaren Eintrag', () => {
    for (const option of buildChoiceOptions()) {
      expect(findBuildChoice(option.value)).toBeDefined();
    }
  });

  it('gibt jedem Eintrag einen Hinweistext', () => {
    for (const option of buildChoiceOptions()) {
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('Submit-Methode', () => {
  it('bietet lokal EAS und Xcode', () => {
    expect(submitMethodOptions('local').map((option) => option.id)).toEqual(['eas', 'xcode']);
  });

  it('bietet in der Cloud nur EAS, weil Xcode ein lokales Archiv braucht', () => {
    expect(submitMethodOptions('cloud').map((option) => option.id)).toEqual(['eas']);
  });
});

describe('profileFor', () => {
  it('ordnet Typ und Ort dem passenden EAS-Profil zu', () => {
    expect(profileFor('testflight', 'cloud')).toBe('preview-testflight');
    expect(profileFor('testflight', 'local')).toBe('preview-testflight-local');
    expect(profileFor('production', 'cloud')).toBe('production');
    expect(profileFor('production', 'local')).toBe('production-local');
  });
});

describe('storeSteps: EAS', () => {
  const base = {
    envFile: '.env.development.local',
    archivePath: 'build/cache/ios/x/fam.xcarchive',
    exportPath: 'build/cache/ios/x/export',
  };

  it('TestFlight Cloud: Build ohne --local, Submit mit --latest', () => {
    const steps = storeSteps({ ...base, type: 'testflight', location: 'cloud', submit: 'eas' });

    expect(steps).toHaveLength(2);
    expect(steps[0].args).toContain('preview-testflight');
    expect(steps[0].args).not.toContain('--local');
    expect(steps[1].args).toContain('--latest');
    expect(steps[1].args).not.toContain('--path');
  });

  it('TestFlight Local: Build mit --local, Submit mit --path', () => {
    const steps = storeSteps({ ...base, type: 'testflight', location: 'local', submit: 'eas' });

    expect(steps[0].args).toContain('preview-testflight-local');
    expect(steps[0].args).toContain('--local');
    expect(steps[0].args).toContain('--output');
    expect(steps[1].args).toContain('--path');
    expect(steps[1].args).not.toContain('--latest');
  });

  it('Production Local nutzt production-local und laedt nach production', () => {
    const steps = storeSteps({ ...base, type: 'production', location: 'local', submit: 'eas' });

    expect(steps[0].args).toContain('production-local');
    expect(steps[1].args).toContain('production');
    expect(steps[1].args).toContain('--path');
  });

  it('Production Cloud laedt den neuesten bei EAS registrierten Build hoch', () => {
    const steps = storeSteps({ ...base, type: 'production', location: 'cloud', submit: 'eas' });

    expect(steps[0].args).toContain('production');
    expect(steps[1].args).toContain('production');
    expect(steps[1].args).toContain('--latest');
  });
});

describe('storeSteps: Xcode', () => {
  const base = {
    envFile: '.env.development.local',
    archivePath: 'build/cache/ios/x/fam.xcarchive',
    exportPath: 'build/cache/ios/x/export',
  };

  it('lokal: prebuild, pod install, archive, dann Export mit Upload', () => {
    const steps = storeSteps({ ...base, type: 'testflight', location: 'local', submit: 'xcode' });

    expect(steps).toHaveLength(5);
    expect(steps[0].command).toBe('env');
    expect(steps[0].args).toContain('prebuild');
    expect(steps[0].args).toContain('FAM_IOS_MLKIT_OCR=1');
    expect(steps[1].command).toBe('pod');
    expect(steps[2].args).toContain('build:version:sync');
    expect(steps[3].args).toContain('archive');
    expect(steps[4].args).toContain('-exportArchive');
    expect(steps[4].args.join(' ')).toContain('ExportOptions-upload.plist');
  });

  it('baut nicht neu auf: prebuild laeuft mit --no-clean', () => {
    const steps = storeSteps({ ...base, type: 'testflight', location: 'local', submit: 'xcode' });

    expect(steps[0].args).toContain('--no-clean');
    expect(steps[0].args).not.toContain('--clean');
  });

  it('Cloud ist ueber Xcode nicht moeglich', () => {
    expect(storeSteps({ ...base, type: 'testflight', location: 'cloud', submit: 'xcode' })).toEqual(
      [],
    );
  });
});

describe('simulatorSteps', () => {
  it('baut mit --clean und liefert den Settings-Schritt zum Pfadablesen', () => {
    const plan = simulatorSteps({
      mode: 'build-only',
      envFile: '.env.development.local',
      cacheName: 'simulator-build-only',
    });

    expect(plan.build).toHaveLength(3);
    expect(plan.build.map((step) => step.command)).toEqual(['env', 'pod', 'xcodebuild']);
    expect(plan.build[0].args).toEqual([
      'FAM_IOS_MLKIT_OCR=0',
      'bun',
      '--env-file=.env.development.local',
      'x',
      'expo',
      'prebuild',
      '--clean',
      '--platform',
      'ios',
      '--no-install',
    ]);
    expect(plan.build[1].args).toEqual(['install', '--project-directory=ios']);
    expect(plan.build[0].args).toContain('FAM_IOS_MLKIT_OCR=0');
    expect(plan.build[0].args).toContain('--clean');
    expect(plan.build[0].args).not.toContain('--no-clean');
    expect(plan.showSettings.args).toContain('-showBuildSettings');
    expect(plan.derivedDataPath).toBe('build/cache/ios/simulator-build-only/DerivedData');
    expect(plan.build[2].args).toContain('generic/platform=iOS Simulator');
  });

  it('baut fuer das Installationsziel auf der ausgewaehlten UDID', () => {
    const plan = simulatorSteps({
      mode: 'install',
      envFile: '.env.development.local',
      udid: 'BDE4',
      cacheName: 'simulator-install',
    });

    expect(plan.build[2].args).toContain('platform=iOS Simulator,id=BDE4');
    expect(plan.derivedDataPath).toBe('build/cache/ios/simulator-install/DerivedData');
  });

  it('bietet separate rohe Simulator-Boot-, Install- und Startbefehle', () => {
    expect(simulatorBootStep('BDE4')).toEqual({
      command: 'xcrun',
      args: ['simctl', 'boot', 'BDE4'],
    });
    expect(simulatorInstallStep('BDE4', '/build/fam.app')).toEqual({
      command: 'xcrun',
      args: ['simctl', 'install', 'BDE4', '/build/fam.app'],
    });
    expect(simulatorLaunchStep('BDE4')).toEqual({
      command: 'xcrun',
      args: ['simctl', 'launch', 'BDE4', 'com.goldjunge91.fam1'],
    });
  });
});

describe('parseAvailableIosSimulators', () => {
  const json = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.watchOS-27-0': [
        { name: 'Watch', udid: 'AAA', state: 'Shutdown', isAvailable: true },
      ],
      'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [
        { name: 'iPhone 17 Pro Max', udid: '818E', state: 'Shutdown', isAvailable: true },
        { name: 'iPhone 12 mini', udid: 'BDE4', state: 'Booted', isAvailable: true },
        { name: 'Alt', udid: 'X', state: 'Shutdown', isAvailable: false },
      ],
    },
  });

  it('liefert nur verfuegbare iOS-Geraete', () => {
    const devices = parseAvailableIosSimulators(json);

    expect(devices.map((device) => device.name)).toEqual(['iPhone 17 Pro Max', 'iPhone 12 mini']);
    expect(devices[1].state).toBe('Booted');
    expect(devices[0].runtime).toBe('iOS-26-2');
  });
});

describe('parseShowBuildSettings', () => {
  it('setzt BUILT_PRODUCTS_DIR und FULL_PRODUCT_NAME zusammen', () => {
    const json = JSON.stringify([
      {
        buildSettings: {
          BUILT_PRODUCTS_DIR: '/tmp/dd/Build/Products/Debug-iphonesimulator',
          FULL_PRODUCT_NAME: 'fam.app',
        },
      },
    ]);

    expect(parseShowBuildSettings(json)).toBe(
      '/tmp/dd/Build/Products/Debug-iphonesimulator/fam.app',
    );
  });

  it('wirft, wenn die Eintraege fehlen', () => {
    expect(() => parseShowBuildSettings(JSON.stringify([{ buildSettings: {} }]))).toThrow(
      /BUILT_PRODUCTS_DIR/,
    );
  });
});

describe('Logging und Zeitmessung', () => {
  it('misst die Abbruchdauer ab Laufstart ueber mehrere Schritte', async () => {
    const pickerUrl = pathToFileURL(path.resolve('scripts/build-picker.ts')).href;
    const harness = [
      `import { abortRun, beginRun, runStep } from ${JSON.stringify(pickerUrl)};`,
      'let now = 1000;',
      'Date.now = () => now;',
      'beginRun();',
      "const step = { command: process.execPath, args: ['-e', 'process.exit(0)'] };",
      'now = 2000;',
      'await runStep(step);',
      'now = 5000;',
      'await runStep(step);',
      'now = 7000;',
      "abortRun('Build fehlgeschlagen.');",
    ].join('\n');
    const child = spawn('bun', ['-e', harness], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once('close', (code, signal) => resolve({ code, signal }));
      },
    );

    expect(result).toEqual({ code: 1, signal: null });
    expect(output).toContain('Gesamtdauer bis zum Abbruch: 6s');
  });

  it('streamt Kindprozessausgabe, bevor der Schritt beendet ist', async () => {
    const tempDirectory = fs.mkdtempSync(
      path.join('/Volumes/Programme/temp_bin', 'build-picker-stream-'),
    );
    const releaseFile = path.join(tempDirectory, 'release');
    const childScript = [
      "const fs = require('node:fs');",
      "process.stdout.write('stdout-live-marker\\n');",
      "process.stderr.write('stderr-live-marker\\n');",
      'const releaseFile = process.argv[1];',
      'const timer = setInterval(() => {',
      '  if (fs.existsSync(releaseFile)) { clearInterval(timer); process.exit(0); }',
      '}, 10);',
    ].join('\n');
    const pickerUrl = pathToFileURL(path.resolve('scripts/build-picker.ts')).href;
    const harness = [
      `import { runStep } from ${JSON.stringify(pickerUrl)};`,
      `runStep({ command: process.execPath, args: ['-e', ${JSON.stringify(childScript)}, ${JSON.stringify(releaseFile)}] });`,
    ].join('\n');
    const child = spawn('bun', ['-e', harness], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let released = false;
    let closed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const closedResult = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once('close', (code, signal) => {
          closed = true;
          resolve({ code, signal });
        });
      },
    );

    try {
      const markerArrivedBeforeRelease = await new Promise<boolean>((resolve) => {
        const deadline = setTimeout(() => resolve(false), 1200);
        const checkOutput = () => {
          if (
            output.includes('stdout-live-marker') &&
            output.includes('stderr-live-marker')
          ) {
            clearTimeout(deadline);
            resolve(true);
          }
        };
        child.stdout.on('data', checkOutput);
        child.stderr.on('data', checkOutput);
        checkOutput();
      });

      expect(closed).toBe(false);
      fs.writeFileSync(releaseFile, 'release');
      released = true;
      const result = await closedResult;
      expect(markerArrivedBeforeRelease).toBe(true);
      expect(result).toEqual({ code: 0, signal: null });
    } finally {
      if (!released) fs.writeFileSync(releaseFile, 'release');
      if (!closed) await closedResult;
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('zeigt die konkrete letzte Kindprozessausgabe bei einem fehlgeschlagenen Schritt', async () => {
    const pickerUrl = pathToFileURL(path.resolve('scripts/build-picker.ts')).href;
    const childScript = [
      "process.stderr.write('No builds found for the selected iOS profile\\n');",
      'process.exit(1);',
    ].join('\n');
    const harness = [
      `import { runStep } from ${JSON.stringify(pickerUrl)};`,
      `await runStep({ command: process.execPath, args: ['-e', ${JSON.stringify(childScript)}] });`,
    ].join('\n');
    const child = spawn('bun', ['-e', harness], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once('close', (code, signal) => resolve({ code, signal }));
      },
    );

    expect(result).toEqual({ code: 0, signal: null });
    expect(output).toContain('Ursache: No builds found for the selected iOS profile');
  });

  it('meldet eine fehlende lokale Submit-IPA, ohne EAS zu starten', async () => {
    const pickerUrl = pathToFileURL(path.resolve('scripts/build-picker.ts')).href;
    const childScript = "process.stdout.write('EAS wurde gestartet\\n');";
    const harness = [
      `import { runStep } from ${JSON.stringify(pickerUrl)};`,
      `await runStep({ command: process.execPath, args: ['-e', ${JSON.stringify(childScript)}, 'submit', '--path', 'build/tmp/missing-build-picker-test.ipa'] });`,
    ].join('\n');
    const child = spawn('bun', ['-e', harness], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once('close', (code, signal) => resolve({ code, signal }));
      },
    );

    expect(result).toEqual({ code: 0, signal: null });
    expect(output).toContain('Submit-Datei fehlt: build/tmp/missing-build-picker-test.ipa');
    expect(output).not.toContain('\nEAS wurde gestartet\n');
  });

  it('legt das Log unter logs/ mit Zeitstempel und Auswahl im Namen ab', () => {
    const path = buildLogPath('testflight-local', new Date('2026-10-03T01:02:03'));

    expect(path).toMatch(/^logs\/build-testflight-local-\d{8}-\d{6}\.log$/);
  });

  it('formatiert Dauern lesbar', () => {
    expect(formatDuration(950)).toBe('950ms');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(120000)).toBe('2m');
  });

  it('rundet auf ganze Sekunden, damit die Dauer beim Rechnen stabil bleibt', () => {
    expect(formatDuration(1499)).toBe('1s');
    expect(formatDuration(1500)).toBe('2s');
  });

  it('schreibt Millisekunden auch unter einer Sekunde mit Einheit', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });
});

describe('Arbeitsverzeichnis fuer lokale EAS-Builds', () => {
  it('legt Workingdir, TMPDIR und Artefakte je Profil getrennt an', () => {
    const env = easLocalBuildEnv('preview-testflight-local', 'abc123');

    expect(env.workingDir).toBe(
      '/Volumes/Programme/temp_bin/eas-local/preview-testflight-local/work',
    );
    expect(env.tmpDir).toBe(
      '/Volumes/Programme/temp_bin/eas-local/preview-testflight-local/tmp.abc123',
    );
    expect(env.artifactsDir).toBe('build/local/eas/preview-testflight-local');
  });

  it('legt das Arbeitsverzeichnis ausserhalb des Projekts ab', () => {
    const env = easLocalBuildEnv('production-local', 'run1');

    expect(env.workingDir.startsWith('/Volumes/Programme/')).toBe(true);
    expect(env.workingDir).not.toContain('/Volumes/Programme/github/family_app/fam');
  });

  it('gibt TMPDIR mit abschliessendem Slash, weil eas-cli darauf den Clone legt', () => {
    const vars = easLocalBuildEnvVars(easLocalBuildEnv('preview-testflight-local', 'x'));

    expect(vars.TMPDIR.endsWith('/')).toBe(true);
    expect(vars.EAS_LOCAL_BUILD_ARTIFACTS_DIR).toBe('build/local/eas/preview-testflight-local');
    expect(vars.EAS_LOCAL_BUILD_WORKINGDIR).toContain('/work');
    expect(vars.EAS_LOCAL_BUILD_SKIP_CLEANUP).toBe('1');
  });

  it('haelt beim Aufraeumen den build-Ordner fuer inkrementelle DerivedData', () => {
    const step = easCleanCloneStep('/Volumes/Programme/temp_bin/eas-local/x/work');

    expect(step.command).toBe('find');
    expect(step.args).toContain('build');
    expect(step.args).toContain('-mindepth');
    expect(step.args).toContain('1');
    expect(step.args).toContain('rm');
  });
});
