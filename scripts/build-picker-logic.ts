/**
 * build-picker-logic.ts — Reine Logik des iOS-Build-Pickers.
 *
 * Modell: erst Typ und Ort (BuildChoice), bei lokalem Store-Build dann die
 * Submit-Methode (EAS oder Xcode). Jede Funktion liefert rohe Befehle als
 * CommandStep — ohne Seiteneffekte, damit die Interaktion in
 * scripts/build-picker.ts bleibt und die Logik hier isoliert testbar ist.
 */

export interface CommandStep {
  command: string;
  args: string[];
}

export const APP_BUNDLE_ID = 'com.goldjunge91.fam1';
const WORKSPACE = 'ios/fam.xcworkspace';
const SCHEME = 'fam';

// `xcodebuild -showBuildSettings -json` liefert die tatsaechlichen Produktpfade.
// So wird der .app-Pfad abgeleitet statt geraten: lokal wurden zwei verschiedene
// DerivedData-Layouts beobachtet (Debug-watchos/ und Debug-iphonesimulator/).
export function parseShowBuildSettings(json: string): string {
  const parsed = JSON.parse(json) as Array<{
    buildSettings?: { BUILT_PRODUCTS_DIR?: string; FULL_PRODUCT_NAME?: string };
  }>;
  const settings = parsed[0]?.buildSettings ?? {};
  if (!settings.BUILT_PRODUCTS_DIR || !settings.FULL_PRODUCT_NAME) {
    throw new Error('BUILT_PRODUCTS_DIR oder FULL_PRODUCT_NAME fehlen in der xcodebuild-Ausgabe.');
  }
  return `${settings.BUILT_PRODUCTS_DIR}/${settings.FULL_PRODUCT_NAME}`;
}

export interface SimulatorDevice {
  name: string;
  udid: string;
  state: string;
  runtime: string;
}

export interface SimulatorBuildOptions {
  udid?: string;
  derivedDataPath: string;
}

function simulatorDestination(udid?: string): string {
  return udid ? `platform=iOS Simulator,id=${udid}` : 'generic/platform=iOS Simulator';
}

// `xcrun simctl list devices available -j` liefert { devices: { <runtimeKey>: [...] } }.
// Nur iOS-Runtimes, nur als verfuegbar markierte Geraete.
// Quelle: `xcrun simctl help list`; Struktur gegen die echte Ausgabe dieser Maschine geprueft.
export function parseAvailableIosSimulators(json: string): SimulatorDevice[] {
  const parsed = JSON.parse(json) as {
    devices?: Record<
      string,
      Array<{ name?: string; udid?: string; state?: string; isAvailable?: boolean }>
    >;
  };
  const runtimes = parsed.devices ?? {};
  const devices: SimulatorDevice[] = [];

  for (const [runtimeKey, entries] of Object.entries(runtimes)) {
    if (!runtimeKey.includes('.SimRuntime.iOS-')) continue;
    const runtime = runtimeKey.replace('com.apple.CoreSimulator.SimRuntime.', '');
    for (const entry of entries ?? []) {
      if (!entry.isAvailable || !entry.name || !entry.udid) continue;
      devices.push({
        name: entry.name,
        udid: entry.udid,
        state: entry.state ?? 'Unknown',
        runtime,
      });
    }
  }

  return devices;
}

// -- CNG-Schritte -----------------------------------------------------------
// `--no-clean` aktualisiert ios/ schrittweise statt es neu zu erzeugen. Ein
// vollstaendiger Neuaufbau wirft die inkrementellen Build-Caches weg; Swift,
// Link und dSYM sind nicht ccache-gedeckt und kosten dann jedes Mal Minuten.
// Quelle: docs.expo.dev Expo CLI `prebuild`.
export function prebuildStep(envFile: string, destination: 'simulator' | 'device'): CommandStep {
  return {
    command: 'env',
    args: [
      `FAM_IOS_MLKIT_OCR=${destination === 'device' ? '1' : '0'}`,
      'bun',
      `--env-file=${envFile}`,
      'x',
      'expo',
      'prebuild',
      '--no-clean',
      '--platform',
      'ios',
      '--no-install',
    ],
  };
}

// prebuild laeuft mit --no-install, deshalb die Pods separat verlinken.
// `pod install` ist idempotent: bei unveraendertem Podfile.lock tut es nichts.
export function podInstallStep(): CommandStep {
  return { command: 'pod', args: ['install', '--project-directory=ios'] };
}

// -- Simulator --------------------------------------------------------------
export function simulatorDerivedDataPath(cacheName: string): string {
  return `build/cache/ios/${cacheName}/DerivedData`;
}

// Quelle: `xcrun simctl help install` / `help launch`; xcodebuild-Flags aus `xcodebuild -help`.
export function simulatorXcodebuildStep({
  udid,
  derivedDataPath,
}: SimulatorBuildOptions): CommandStep {
  return {
    command: 'xcodebuild',
    args: [
      '-workspace',
      WORKSPACE,
      '-scheme',
      SCHEME,
      '-configuration',
      'Debug',
      '-destination',
      simulatorDestination(udid),
      '-jobs',
      '10',
      '-derivedDataPath',
      derivedDataPath,
      'COMPILER_INDEX_STORE_ENABLE=NO',
      'build',
    ],
  };
}

export function simulatorShowSettingsStep({
  udid,
  derivedDataPath,
}: SimulatorBuildOptions): CommandStep {
  return {
    command: 'xcodebuild',
    args: [
      '-workspace',
      WORKSPACE,
      '-scheme',
      SCHEME,
      '-configuration',
      'Debug',
      '-destination',
      simulatorDestination(udid),
      '-derivedDataPath',
      derivedDataPath,
      '-showBuildSettings',
      '-json',
    ],
  };
}

// Ein Shutdown-Simulator kann keine App installieren, deshalb zuerst booten.
// Quelle: `xcrun simctl help boot`.
export function simulatorBootStep(udid: string): CommandStep {
  return { command: 'xcrun', args: ['simctl', 'boot', udid] };
}

export function simulatorInstallStep(udid: string, appPath: string): CommandStep {
  return { command: 'xcrun', args: ['simctl', 'install', udid, appPath] };
}

export function simulatorLaunchStep(udid: string): CommandStep {
  return { command: 'xcrun', args: ['simctl', 'launch', udid, APP_BUNDLE_ID] };
}

// -- Store-Build ueber Xcode ------------------------------------------------
// Release-Archiv fuer ein echtes Geraet.
export function storeArchiveStep(archivePath: string): CommandStep {
  return {
    command: 'xcodebuild',
    args: [
      '-workspace',
      WORKSPACE,
      '-scheme',
      SCHEME,
      '-configuration',
      'Release',
      '-destination',
      'generic/platform=iOS',
      '-archivePath',
      archivePath,
      'archive',
    ],
  };
}

// Export und Upload in einem Schritt. Quelle: `xcodebuild -help`, Key `destination`:
// "Determines whether the app is exported locally or uploaded to Apple.
// Options are export or upload."
export const XCODE_UPLOAD_EXPORT_OPTIONS = 'scripts/ExportOptions-upload.plist';

export function storeExportUploadStep(options: {
  archivePath: string;
  exportPath: string;
  exportOptionsPlist: string;
}): CommandStep {
  return {
    command: 'xcodebuild',
    args: [
      '-exportArchive',
      '-archivePath',
      options.archivePath,
      '-exportPath',
      options.exportPath,
      '-exportOptionsPlist',
      options.exportOptionsPlist,
    ],
  };
}

// -- Menue: Typ und Ort in einer Ebene --------------------------------------
export type StoreType = 'testflight' | 'production';
export type BuildType = StoreType | 'simulator';
export type BuildLocation = 'cloud' | 'local';
export type SubmitMethod = 'eas' | 'xcode';
export type SimulatorMode = 'build-only' | 'install';

export interface BuildChoice {
  id: string;
  label: string;
  hint: string;
  type: BuildType;
  /** Nur bei Store-Typen gesetzt. Simulator baut immer lokal. */
  location?: BuildLocation;
  simulatorMode?: SimulatorMode;
}

export const BUILD_CHOICES: BuildChoice[] = [
  {
    id: 'testflight-cloud',
    label: 'TestFlight Cloud',
    hint: 'Build auf EAS-Servern, Upload zu TestFlight.',
    type: 'testflight',
    location: 'cloud',
  },
  {
    id: 'testflight-local',
    label: 'TestFlight Local',
    hint: 'Build auf dieser Maschine, Upload zu TestFlight (EAS oder Xcode).',
    type: 'testflight',
    location: 'local',
  },
  {
    id: 'production-cloud',
    label: 'Production Cloud',
    hint: 'Build auf EAS-Servern, Upload zu App Store Connect.',
    type: 'production',
    location: 'cloud',
  },
  {
    id: 'production-local',
    label: 'Production Local',
    hint: 'Build auf dieser Maschine, Upload zu App Store Connect (EAS oder Xcode).',
    type: 'production',
    location: 'local',
  },
  {
    id: 'simulator-build-only',
    label: 'Simulator ohne Installation',
    hint: 'Build erstellen und den Speicherort der App ausgeben.',
    type: 'simulator',
    simulatorMode: 'build-only',
  },
  {
    id: 'simulator-install',
    label: 'Simulator mit Installation',
    hint: 'Build erstellen, Simulator waehlen, installieren und starten.',
    type: 'simulator',
    simulatorMode: 'install',
  },
];

export function buildChoiceOptions(): Array<{ value: string; label: string; hint: string }> {
  return BUILD_CHOICES.map((choice) => ({
    value: choice.id,
    label: choice.label,
    hint: choice.hint,
  }));
}

export function findBuildChoice(id: string): BuildChoice | undefined {
  return BUILD_CHOICES.find((choice) => choice.id === id);
}

// -- Submit-Methode ---------------------------------------------------------
export interface SubmitMethodOption {
  id: SubmitMethod;
  label: string;
  hint: string;
}

// Xcode braucht ein lokales Archiv. Aus der Cloud gibt es kein Archiv, deshalb
// steht dort nur EAS zur Verfuegung.
export function submitMethodOptions(location: BuildLocation): SubmitMethodOption[] {
  const eas: SubmitMethodOption = {
    id: 'eas',
    label: 'EAS Submit',
    hint: 'Upload ueber eas submit — mit --latest (Cloud) oder --path (lokal).',
  };
  if (location === 'cloud') return [eas];
  return [
    eas,
    {
      id: 'xcode',
      label: 'Xcode',
      hint: 'Upload ueber xcodebuild -exportArchive (destination=upload).',
    },
  ];
}

// -- Profile ----------------------------------------------------------------
export function profileFor(type: StoreType, location: BuildLocation): string {
  const local = location === 'local';
  if (type === 'testflight') return local ? 'preview-testflight-local' : 'preview-testflight';
  return local ? 'production-local' : 'production';
}

export function submitProfileFor(type: StoreType): string {
  return type === 'testflight' ? 'preview-testflight' : 'production';
}

export function localIpaPath(profile: string): string {
  return `build/local/eas/${profile}/fam.ipa`;
}

// -- Konkrete Ablaeufe ------------------------------------------------------
export interface StoreStepsOptions {
  type: StoreType;
  location: BuildLocation;
  submit: SubmitMethod;
  envFile: string;
  archivePath: string;
  exportPath: string;
}

// Lokaler EAS-Build schreibt eine IPA und haengt sie an; der Cloud-Build liegt
// bei EAS und wird ueber --latest hochgeladen. Quelle: `eas-cli build --help`.
export function storeSteps(options: StoreStepsOptions): CommandStep[] {
  const profile = profileFor(options.type, options.location);
  const submitProfile = submitProfileFor(options.type);

  if (options.submit === 'xcode') {
    // Kein Archiv in der Cloud, daher nur lokal moeglich.
    if (options.location !== 'local') return [];
    return [
      prebuildStep(options.envFile, 'device'),
      podInstallStep(),
      {
        command: 'bun',
        args: [
          'x',
          'eas-cli',
          'build:version:sync',
          '--platform',
          'ios',
          '--profile',
          submitProfile,
        ],
      },
      storeArchiveStep(options.archivePath),
      storeExportUploadStep({
        archivePath: options.archivePath,
        exportPath: options.exportPath,
        exportOptionsPlist: XCODE_UPLOAD_EXPORT_OPTIONS,
      }),
    ];
  }

  if (options.location === 'local') {
    const ipa = localIpaPath(profile);
    return [
      {
        command: 'bun',
        args: [
          'x',
          'eas-cli',
          'build',
          '--platform',
          'ios',
          '--profile',
          profile,
          '--local',
          '--output',
          ipa,
        ],
      },
      {
        command: 'bun',
        args: [
          'x',
          'eas-cli',
          'submit',
          '--platform',
          'ios',
          '--profile',
          submitProfile,
          '--path',
          ipa,
        ],
      },
    ];
  }

  return [
    {
      command: 'bun',
      args: ['x', 'eas-cli', 'build', '--platform', 'ios', '--profile', profile],
    },
    {
      command: 'bun',
      args: ['x', 'eas-cli', 'submit', '--platform', 'ios', '--profile', submitProfile, '--latest'],
    },
  ];
}

export interface SimulatorStepsOptions {
  mode: SimulatorMode;
  envFile: string;
  udid?: string;
  cacheName: string;
}

// -- Arbeitsverzeichnis fuer lokale EAS-Builds ---------------------------
// eas-cli legt beim Komprimieren einen shallow Clone des Projekts an und
// arbeitet darin. Bleibt der Build im Projektverzeichnis selbst, liest
// eas-cli das lokale ios/ mit den CocoaPods-Dependencies. Bei statischen
// Frameworks (ML Kit erzwingt use_frameworks! :linkage => :static) schreibt
// CocoaPods jede Pod-Dependency ohne target-Feld, und
// @expo/config-plugins bricht dann in getTargetDependencies ab mit
// "Could not find target with id 'undefined'".
//
// Deshalb laeuft der lokale Build in einem frischen, von uns bereitgestellten
// Verzeichnis ausserhalb des Projekts. Der Weg ist derselbe wie in
// scripts/eas-ios-build.sh: TMPDIR und Workingdir liegen unter
// /Volumes/Programme, nicht im Projekt, weil eas-cli sonst abbricht mit
// "cannot copy <projekt> to a subdirectory of self".
export const EAS_LOCAL_ROOT = '/Volumes/Programme/temp_bin/eas-local';

export interface EasLocalBuildEnv {
  /** Workingdir fuer den Build; existiert noch nicht, wird angelegt. */
  workingDir: string;
  /** Frisches TMPDIR je Lauf, damit eas-cli darin seinen Clone ablegen kann. */
  tmpDir: string;
  /** Artefaktverzeichnis fuer die fertige IPA. */
  artifactsDir: string;
}

export function easLocalBuildEnv(profile: string, runId: string): EasLocalBuildEnv {
  const root = `${EAS_LOCAL_ROOT}/${profile}`;
  return {
    workingDir: `${root}/work`,
    tmpDir: `${root}/tmp.${runId}`,
    artifactsDir: `build/local/eas/${profile}`,
  };
}

// eas-cli braucht fuer den lokalen Build drei Variablen. Ohne sie legt es
// Clone und Artefakte unter TMPDIR bzw. neben dem Projekt ab.
export function easLocalBuildEnvVars(env: EasLocalBuildEnv): Record<string, string> {
  return {
    EAS_LOCAL_BUILD_WORKINGDIR: env.workingDir,
    TMPDIR: `${env.tmpDir}/`,
    EAS_LOCAL_BUILD_ARTIFACTS_DIR: env.artifactsDir,
  };
}

// Der Workingdir ist ein flacher Clone des Projekts ohne ios/ und ohne
// node_modules. eas-cli installiert dort selbst. Vor jedem Lauf wird alles
// ausser build/ entfernt, damit keine Reste des vorigen Laufs im Clone
// landen; build/ bleibt erhalten, weil DerivedData dort inkrementell
// weiterverwendet wird.
export function easCleanCloneStep(workingDir: string): CommandStep {
  return {
    command: 'find',
    args: [
      workingDir,
      '-mindepth',
      '1',
      '-maxdepth',
      '1',
      '!',
      '-name',
      'build',
      '-exec',
      'rm',
      '-rf',
      '{}',
      '+',
    ],
  };
}

export interface SimulatorSteps {
  build: CommandStep[];
  /** Liest den Produktpfad; danach entscheidet die Shell ueber install/start. */
  showSettings: CommandStep;
  derivedDataPath: string;
}

export function simulatorSteps(options: SimulatorStepsOptions): SimulatorSteps {
  const derivedDataPath = simulatorDerivedDataPath(options.cacheName);
  return {
    build: [
      prebuildStep(options.envFile, 'simulator'),
      podInstallStep(),
      simulatorXcodebuildStep({ udid: options.udid, derivedDataPath }),
    ],
    showSettings: simulatorShowSettingsStep({ udid: options.udid, derivedDataPath }),
    derivedDataPath,
  };
}

// -- Logging ----------------------------------------------------------------
// Jeder Lauf bekommt eine eigene Logdatei unter logs/ (gitignored, siehe .gitignore).
export function buildLogPath(choiceId: string, date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `logs/build-${choiceId}-${stamp}.log`;
}

// Dauer lesbar machen: 950 -> "0.9s", 65000 -> "1m 5s".
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}
