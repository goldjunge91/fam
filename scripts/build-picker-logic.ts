/**
 * build-picker-logic.ts — Reine Logik des iOS-Build-Pickers.
 *
 * Enthält die Profil-Tabelle und die Kommando-Argumente für
 * scripts/eas-ios-build.sh bzw. eas submit — ohne Seiteneffekte, damit
 * test/build-picker.test.ts das Modul unter Jest importieren kann.
 * Die interaktive Shell lebt in scripts/build-picker.ts.
 */

import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const buildScript = path.join(projectRoot, 'scripts', 'eas-ios-build.sh');

type Group = 'Development' | 'Preview' | 'TestFlight' | 'Production';

export interface BuildVariant {
  easProfile: string;
  group: Group;
  /** Submit-Profil aus eas.json — nur bei Store-Distribution gesetzt. */
  submitProfile?: string;
  /** `-local`-Profile bauen auf dieser Maschine, alle anderen in der EAS Cloud. */
  local: boolean;
  hint: string;
}

export interface CommandStep {
  command: string;
  args: string[];
}

const VARIANTS: BuildVariant[] = [
  {
    easProfile: 'development',
    group: 'Development',
    local: false,
    hint: 'Dev-Client für den iOS-Simulator (Cloud-Build). App-Code kommt live vom Metro-Server (bun run start).',
  },
  {
    easProfile: 'development-local',
    group: 'Development',
    local: true,
    hint: 'Derselbe Dev-Client für den Simulator, aber lokal gebaut — ohne Cloud-Build-Kontingent.',
  },
  {
    easProfile: 'development-device',
    group: 'Development',
    local: false,
    hint: 'Dev-Client für das physische iPhone, mit ML-Kit-OCR statt Apple Vision.',
  },
  {
    easProfile: 'preview',
    group: 'Preview',
    local: false,
    hint: 'Voll gebündelter Test-Build ohne Dev-Overlays. Zum direkten Installieren auf Testgeräten, nicht für Stores.',
  },
  {
    easProfile: 'preview-testflight',
    group: 'TestFlight',
    submitProfile: 'preview-testflight',
    local: false,
    hint: 'Store-signierter TestFlight-Build (Cloud). Dev-Tools bleiben aktiv, Sentry-Upload ist aus.',
  },
  {
    easProfile: 'preview-testflight-local',
    group: 'TestFlight',
    submitProfile: 'preview-testflight',
    local: true,
    hint: 'Derselbe TestFlight-Build, lokal gebaut. Identisch signiert — direkt nach TestFlight ladbar.',
  },
  {
    easProfile: 'production',
    group: 'Production',
    submitProfile: 'production',
    local: false,
    hint: 'App-Store-Release (Cloud). Produktions-Secrets, keine Dev-Tools.',
  },
  {
    easProfile: 'production-local',
    group: 'Production',
    submitProfile: 'production',
    local: true,
    hint: 'Derselbe App-Store-Release, lokal gebaut. Upload geht an App Store Connect.',
  },
];

const GROUP_ORDER: Group[] = ['Development', 'Preview', 'TestFlight', 'Production'];

export function findVariant(easProfile: string): BuildVariant | undefined {
  return VARIANTS.find((variant) => variant.easProfile === easProfile);
}

export function menuOptions(): Array<{
  value: string;
  label: string;
  hint: string;
}> {
  return GROUP_ORDER.flatMap((group) =>
    VARIANTS.filter((variant) => variant.group === group).map((variant) => ({
      value: variant.easProfile,
      label: `${group} · ${variant.easProfile}${variant.local ? ' (lokal)' : ' (Cloud)'}`,
      hint: variant.hint,
    })),
  );
}

export function localOutputPath(variant: BuildVariant): string {
  return path.join(projectRoot, 'build', 'local', 'eas', variant.easProfile, 'fam.ipa');
}

export function buildCommandArgs(variant: BuildVariant): CommandStep {
  const outputArgs = variant.local
    ? ['--output', path.relative(projectRoot, localOutputPath(variant))]
    : [];
  return {
    command: 'bash',
    args: [
      path.relative(projectRoot, buildScript),
      variant.local ? 'local' : 'cloud',
      variant.easProfile,
      ...outputArgs,
    ],
  };
}

export function submitCommandArgs(
  variant: BuildVariant,
  ipaPath: string | null,
): CommandStep | null {
  if (!variant.submitProfile) return null;
  const distributionArgs = variant.local && ipaPath ? ['--path', ipaPath] : ['--latest'];
  return {
    command: 'bun',
    args: [
      'x',
      'eas-cli',
      'submit',
      '--platform',
      'ios',
      '--profile',
      variant.submitProfile,
      ...distributionArgs,
    ],
  };
}

export function uploadQuestion(variant: BuildVariant): string | null {
  if (!variant.submitProfile) return null;
  return variant.submitProfile === 'production'
    ? 'Nach dem Build automatisch zu App Store Connect hochladen?'
    : 'Nach dem Build automatisch zu TestFlight hochladen?';
}
