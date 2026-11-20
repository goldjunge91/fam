import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const IOS_ROOT = join(REPO_ROOT, '.maestro', 'ios');
const IOS_SUBFLOWS_ROOT = join(IOS_ROOT, 'subflows');
const TEST_EMAIL_PLACEHOLDER = '${' + 'TEST_EMAIL}';
const REMOTE_CONFIRMED_EMAIL_PLACEHOLDER = '${' + 'REMOTE_CONFIRMED_EMAIL}';
const TEST_PASSWORD_PLACEHOLDER = '${' + 'TEST_PASSWORD}';
const RESET_PASSWORD_PLACEHOLDER = '${' + 'RESET_PASSWORD}';
const WRONG_EMAIL_PLACEHOLDER = '${' + 'WRONG_EMAIL}';
const WRONG_PASSWORD_PLACEHOLDER = '${' + 'WRONG_PASSWORD}';
const FIXTURE_EMAIL_PLACEHOLDER = '${' + 'EMAIL}';
const FIXTURE_PASSWORD_PLACEHOLDER = '${' + 'PASSWORD}';
const RECOVERY_CODE_OUTPUT = '${' + 'output.recoveryCode}';
const RECOVERY_LINK_OUTPUT = '${' + 'output.recoveryLink}';
const REMOTE_EMAIL_OUTPUT = '${' + 'output.testEmail}';
const CONFIRMED_REMOTE_EMAIL_OUTPUT = '${' + 'output.confirmedRecoveryEmail}';
const REMOTE_REQUEST_STARTED_OUTPUT = '${' + 'output.recoveryRequestStartedAt}';
const MAILOSAUR_ADDRESS_SUFFIX_PLACEHOLDER = '${' + 'MAILOSAUR_ADDRESS_SUFFIX}';
const MAILOSAUR_ADDRESS_TYPO = ['MAILOSAUR', 'ADRESS'].join('_');
const TEST_ID_PREFIX_PLACEHOLDER = '${' + 'testIDPrefix}';
const METRO_URL_PLACEHOLDER = '${' + 'METRO_URL}';
const REMOTE_LAUNCH_SUBFLOW = '../../subflows/launch-local-dev-client-remote-preserve-state.yaml';

const ATOMIC_SUBFLOWS = {
  launch: 'launch-local-dev-client.yaml',
  welcome: 'onboarding-welcome.yaml',
  registration: 'onboarding-sign-up.yaml',
  login: 'onboarding-sign-in.yaml',
  finish: 'onboarding-finish.yaml',
} as const;

const AUTH_JOURNEYS = {
  registration: {
    file: join(IOS_ROOT, 'flows', 'auth', 'registration.yaml'),
    subflows: [
      '../../subflows/launch-local-dev-client-preserve-state.yaml',
      '../../subflows/onboarding-welcome.yaml',
      '../../subflows/onboarding-sign-up.yaml',
      '../../subflows/onboarding-finish.yaml',
    ],
  },
  login: {
    file: join(IOS_ROOT, 'flows', 'auth', 'login.yaml'),
    subflows: [
      '../../subflows/launch-local-dev-client-preserve-state.yaml',
      '../../subflows/onboarding-welcome.yaml',
      '../../subflows/onboarding-sign-in.yaml',
      '../../subflows/onboarding-finish.yaml',
    ],
  },
} as const;

function readFlow(file: string): string {
  return readFileSync(file, 'utf8');
}

function flowBody(flow: string): string {
  const separator = flow.indexOf('\n---');
  return separator === -1 ? '' : flow.slice(separator + '\n---'.length);
}

function topLevelCommands(flow: string): string[] {
  return flowBody(flow)
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '));
}

function directSubflowReferences(flow: string): string[] {
  const references: string[] = [];
  const referencePattern =
    /^(?:- runFlow:\s+| {4}file:\s+)(\.\.\/\.\.\/subflows\/[^\s]+\.yaml)\s*$/gm;

  for (const match of flow.matchAll(referencePattern)) {
    const reference = match[1];
    if (reference) references.push(reference);
  }

  return references;
}

function collectYamlFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectYamlFiles(path));
    } else if (entry.name.endsWith('.yaml')) {
      files.push(path);
    }
  }

  return files;
}

describe('iOS Maestro auth flow structure', () => {
  it('keeps each onboarding responsibility in a self-contained atomic subflow', () => {
    const requiredMarkers = {
      launch: [
        'Enter URL manually',
        `setClipboard: "${METRO_URL_PLACEHOLDER}"`,
        '- pasteText',
        'tapOn: "Connect"',
        'visible: "Willkommen"',
        'visible: "Weiter"',
      ],
      welcome: ['Geteilte Einkaufsliste', 'Privates Kalorien-Tracking', 'Jetzt starten'],
      registration: [
        'generate-registration-data.js',
        'read-local-confirmation-code.js',
        'id: "sign-up-email"',
        'id: "sign-up-password"',
        'id: "sign-up-password-confirmation"',
        'id: "sign-up-submit"',
        `setClipboard: "\${output.auth.confirmationCode}"`,
        '- pasteText',
        'id: "email-verification-code"',
        `assertTrue: \${output.confirmationCodeInput == output.auth.confirmationCode}`,
        'text: "^(Done|Fertig)$"',
      ],
      login: [
        TEST_EMAIL_PLACEHOLDER,
        TEST_PASSWORD_PLACEHOLDER,
        'id: "sign-in-email"',
        'id: "sign-in-password"',
        'tapOn: "Ich habe schon ein Konto"',
      ],
      finish: ['Später ausfüllen', 'Zum Dashboard', '^(Übersicht|Overview)$'],
    } as const;

    for (const responsibility of Object.keys(ATOMIC_SUBFLOWS) as Array<
      keyof typeof ATOMIC_SUBFLOWS
    >) {
      const fileName = ATOMIC_SUBFLOWS[responsibility];
      const flow = readFlow(join(IOS_SUBFLOWS_ROOT, fileName));

      expect(flow).toContain('appId: com.goldjunge91.fam1');
      expect(flow).not.toContain('# Vollständige Journey:');
      expect(flow).not.toMatch(/^ {4}file:\s+\.\.\/\.\.\/subflows\/.*$/m);

      for (const marker of requiredMarkers[responsibility]) {
        expect(flow).toContain(marker);
      }
    }
  });

  it.each(Object.entries(AUTH_JOURNEYS))(
    'composes the positive %s journey directly from atomic runFlow calls',
    (_journey, journey) => {
      const flow = readFlow(journey.file);
      const commands = topLevelCommands(flow);

      expect(commands.length).toBeGreaterThan(0);
      expect(
        commands.every(
          (command) => command.startsWith('- runFlow:') || command.startsWith('- assertVisible:'),
        ),
      ).toBe(true);
      expect(directSubflowReferences(flow)).toEqual(journey.subflows);
      expect(commands.at(-1)).toMatch(/^- assertVisible: "\^\(Übersicht\|Overview\)\$"$/);
    },
  );

  it('keeps registration and login as separate positive journeys to the dashboard', () => {
    const registration = readFlow(AUTH_JOURNEYS.registration.file);
    const login = readFlow(AUTH_JOURNEYS.login.file);

    expect(registration).toContain('../../subflows/onboarding-sign-up.yaml');
    expect(registration).not.toContain('../../subflows/onboarding-sign-in.yaml');
    expect(login).toContain('../../subflows/onboarding-sign-in.yaml');
    expect(login).not.toContain('../../subflows/onboarding-sign-up.yaml');

    expect(registration).toMatch(/assertVisible: "\^\(Übersicht\|Overview\)\$"/);
    expect(login).toMatch(/assertVisible: "\^\(Übersicht\|Overview\)\$"/);
  });

  it('does not retain or reference the former aggregate sign-in subflow', () => {
    const oldSubflow = join(IOS_SUBFLOWS_ROOT, 'reach-dashboard-via-sign-in.yaml');

    expect(existsSync(oldSubflow)).toBe(false);
    for (const file of collectYamlFiles(IOS_ROOT)) {
      expect(readFlow(file)).not.toContain('reach-dashboard-via-sign-in');
    }
  });

  it('exposes one stable submit target instead of matching the duplicate registration title', () => {
    const signUpForm = readFlow(
      join(REPO_ROOT, 'src', 'features', 'auth', 'forms', 'sign-up-form.tsx'),
    );
    const registration = readFlow(join(IOS_SUBFLOWS_ROOT, ATOMIC_SUBFLOWS.registration));

    expect(signUpForm).toContain(`testID={\`${TEST_ID_PREFIX_PLACEHOLDER}-submit\`}`);
    expect(registration).toContain('id: "sign-up-submit"');
    expect(registration).not.toContain('tapOn: "Konto erstellen"');
  });

  it('keeps TEST_EMAIL and TEST_PASSWORD externally overridable through the login journey', () => {
    const signIn = readFlow(join(IOS_SUBFLOWS_ROOT, ATOMIC_SUBFLOWS.login));
    const login = readFlow(AUTH_JOURNEYS.login.file);

    expect(signIn).toMatch(/^\s+TEST_EMAIL:\s+\$\{TEST_EMAIL\s+\|\|\s+["'][^"']+["']\}$/m);
    expect(signIn).toMatch(/^\s+TEST_PASSWORD:\s+\$\{TEST_PASSWORD\s+\|\|\s+["'][^"']+["']\}$/m);
    expect(signIn).toContain(`setClipboard: "${TEST_EMAIL_PLACEHOLDER}"`);
    expect(signIn).toContain(`setClipboard: "${TEST_PASSWORD_PLACEHOLDER}"`);
    expect(signIn.match(/- pasteText/g)).toHaveLength(2);

    expect(login).toMatch(/^\s+TEST_EMAIL:\s+\$\{TEST_EMAIL\s+\|\|\s+["'][^"']+["']\}$/m);
    expect(login).toMatch(/^\s+TEST_PASSWORD:\s+\$\{TEST_PASSWORD\s+\|\|\s+["'][^"']+["']\}$/m);
    expect(login).toMatch(/^\s+TEST_EMAIL:\s+"\$\{TEST_EMAIL\}"$/m);
    expect(login).toMatch(/^\s+TEST_PASSWORD:\s+"\$\{TEST_PASSWORD\}"$/m);
  });

  it('uses stable live sign-in field and submit identifiers', () => {
    const signIn = readFlow(join(IOS_SUBFLOWS_ROOT, ATOMIC_SUBFLOWS.login));
    const signInForm = readFlow(
      join(REPO_ROOT, 'src', 'features', 'auth', 'forms', 'sign-in-form.tsx'),
    );

    expect(signIn).toContain('id: "sign-in-email"');
    expect(signIn).toContain('id: "sign-in-password"');
    expect(signIn).toContain('id: "sign-in-submit"');
    expect(signIn).toContain('tapOn: "Ich habe schon ein Konto"');
    expect(signInForm).toContain(`testID={\`${TEST_ID_PREFIX_PLACEHOLDER}-submit\`}`);
    expect(signIn).not.toContain('onboarding-account-email');
    expect(signIn).not.toContain('onboarding-account-password');
    expect(signIn).not.toContain('Anmelden & weiter');
    expect(signIn).not.toContain('text: "Anmelden"');
  });

  it('uses the stable module continuation before waiting for permissions', () => {
    const finish = readFlow(join(IOS_SUBFLOWS_ROOT, ATOMIC_SUBFLOWS.finish));

    expect(finish).toContain('element: "Weiter"');
    expect(finish).toContain(
      '- runFlow:\n    when:\n      visible: "Später ausfüllen"\n    commands:',
    );
    expect(finish).toContain('point: "26%,93%"');
    expect(finish).toContain('point: "26%,81%"');
    expect(finish).not.toContain('Überspringen');
    expect(finish).toContain('retryTapIfNoChange: true');
    expect(finish).toContain('waitToSettleTimeoutMs: 10000');
    expect(finish).toContain('visible: "Jetzt nicht"');
    expect(finish).toContain('text: "^(Später|Not Now)$"');
    expect(finish).toContain('optional: true');
  });

  it('keeps negative and recovery journeys on current sign-in selectors', () => {
    const invalidSignIn = readFlow(join(IOS_SUBFLOWS_ROOT, 'onboarding-sign-in-invalid.yaml'));
    const passwordReset = readFlow(join(IOS_ROOT, 'flows', 'auth', 'password-reset.yaml'));
    const wrongEmail = readFlow(join(IOS_ROOT, 'flows', 'auth', 'login-wrong-email.yaml'));
    const wrongPassword = readFlow(join(IOS_ROOT, 'flows', 'auth', 'login-wrong-password.yaml'));

    expect(invalidSignIn).toContain('tapOn: "Ich habe schon ein Konto"');
    expect(invalidSignIn).toContain('id: "sign-in-email"');
    expect(invalidSignIn).toContain('id: "sign-in-password"');
    expect(invalidSignIn).toContain('id: "sign-in-submit"');
    expect(invalidSignIn).toContain(`setClipboard: "${TEST_EMAIL_PLACEHOLDER}"`);
    expect(invalidSignIn).toContain(`setClipboard: "${TEST_PASSWORD_PLACEHOLDER}"`);
    expect(invalidSignIn).not.toContain('onboarding-account-email');
    expect(invalidSignIn).not.toContain('Anmelden & weiter');

    expect(passwordReset).toContain('tapOn: "Ich habe schon ein Konto"');
    expect(passwordReset).toContain('visible: "Ich habe schon ein Konto"');
    expect(passwordReset).toContain(
      '- runFlow:\n    when:\n      visible:\n        id: "sign-in-email"\n    commands:',
    );
    expect(passwordReset).toContain('tapOn: "Passwort vergessen"');
    expect(passwordReset).toContain('id: "forgot-password-email"');
    expect(passwordReset).toContain('id: "password-recovery-email"');
    expect(passwordReset).toContain(`setClipboard: "${TEST_EMAIL_PLACEHOLDER}"`);
    expect(passwordReset).toContain('RESET_PASSWORD: ${' + 'RESET_PASSWORD ||');
    expect(passwordReset).toContain(`setClipboard: "${RESET_PASSWORD_PLACEHOLDER}"`);
    expect(passwordReset).toContain('../../subflows/launch-local-dev-client-preserve-state.yaml');
    expect(passwordReset).toContain('visible: "Willkommen"');
    expect(passwordReset).toContain('text: "^(Später|Not Now)$"');
    expect(passwordReset).toContain('optional: true');
    expect(passwordReset).toContain('tapOn: "^(Code anfordern|Request code)$"');
    expect(passwordReset).toContain('Code in der App eingeben');
    expect(passwordReset).toContain('read-local-password-recovery-code.js');
    expect(passwordReset).toContain('../../../scripts/auth/read-local-password-recovery-code.js');
    expect(passwordReset).toContain('visible: "^(E-Mail unterwegs|Email on its way)$"');
    expect(passwordReset).toContain(
      '- runFlow:\n    when:\n      visible: "E-Mail-Adresse ändern"\n    commands:',
    );
    expect(passwordReset).toContain(
      '- runFlow:\n    when:\n      visible:\n        id: "password-recovery-code"\n    commands:',
    );
    expect(passwordReset).toContain('id: "password-recovery-code"');
    expect(passwordReset).not.toContain('hideKeyboard');
    expect(passwordReset).toContain(
      `- setClipboard: "${RECOVERY_CODE_OUTPUT}"\n      - pasteText\n      - tapOn:\n          text: "Go"`,
    );
    expect(passwordReset).toContain('id: "recovery-new-password"');
    expect(passwordReset).toContain('id: "recovery-password-confirmation"');
    expect(passwordReset).toContain('tapOn: "Passwort speichern"');
    expect(passwordReset).toContain('visible: "Passwort geändert"');
    expect(passwordReset).toMatch(/assertVisible: "\^\(Übersicht\|Overview\)\$"/);
    expect(passwordReset).not.toContain('tapOn: "^(Link anfordern|Request link)$"');
    expect(passwordReset).not.toContain('tapOn: "Anmelden"');

    expect(wrongEmail).toContain('WRONG_EMAIL: ${WRONG_EMAIL ||');
    expect(wrongEmail).toContain(`TEST_EMAIL: "${WRONG_EMAIL_PLACEHOLDER}"`);
    expect(wrongEmail).toContain(`TEST_PASSWORD: "${WRONG_PASSWORD_PLACEHOLDER}"`);
    expect(wrongPassword).toContain('WRONG_PASSWORD: ${WRONG_PASSWORD ||');
    expect(wrongPassword).toContain(`TEST_EMAIL: "${TEST_EMAIL_PLACEHOLDER}"`);
    expect(wrongPassword).toContain(`TEST_PASSWORD: "${WRONG_PASSWORD_PLACEHOLDER}"`);
  });

  it('starts remote code recovery from visible localized text, not sign-in-email', () => {
    const remoteCodeFlow = readFlow(
      join(IOS_ROOT, 'flows', 'auth', 'password-reset-remote-code.yaml'),
    );
    const recoveryGate =
      '- runFlow:\n' +
      '    when:\n' +
      '      visible: "^(Anmelden|Sign in|Passwort vergessen|Forgot password)$"\n' +
      '    commands:\n' +
      '      - tapOn: "^(Passwort vergessen|Forgot password)$"';

    expect(remoteCodeFlow).toContain(recoveryGate);
  });

  it('starts remote journeys from the installed Dev Client without clearing state', () => {
    const launch = readFlow(
      join(IOS_SUBFLOWS_ROOT, 'launch-local-dev-client-remote-preserve-state.yaml'),
    );

    expect(launch).toContain('launchApp:\n    clearState: false');
    expect(launch).toContain('visible: "Enter URL manually"');
    expect(launch).toContain(`inputText: "\${METRO_URL}"`);
    expect(launch).not.toContain('setClipboard:');
    expect(launch).not.toContain('pasteText');
    expect(launch).toContain('tapOn: "Connect"');
    expect(launch).toContain(
      "visible: '^(Willkommen|Weiter|Anmelden|Sign in|Ich habe schon ein Konto|Noch kein Konto\\? Registrieren|No account yet\\? Sign up|Passwort vergessen|Forgot password|Konto erstellen|Create account|Passwort zurücksetzen|Reset password|E-Mail unterwegs|Email on its way|E-Mail-Adresse ändern|E-Mail-Code eingeben|Enter email code|Neues Passwort|New password|Bestätigung ausstehend|Dein Profil|Passwort geändert|Password changed|Übersicht|Overview)$'",
    );
    expect(launch).toContain('timeout: 120000');
    expect(launch).not.toContain('clearState: true');

    for (const fileName of [
      'registration-remote-mailosaur.yaml',
      'password-reset-remote-code.yaml',
      'password-reset-remote-link.yaml',
    ]) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', fileName));

      expect(flow).toContain(REMOTE_LAUNCH_SUBFLOW);
      expect(flow).not.toContain('../../subflows/launch-local-dev-client-preserve-state.yaml');
    }
  });

  it('enters password recovery from a visible sign-in screen in both remote modes', () => {
    for (const fileName of ['password-reset-remote-code.yaml', 'password-reset-remote-link.yaml']) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', fileName));

      expect(flow).toContain(
        '- runFlow:\n    when:\n      visible: "^(Anmelden|Sign in|Passwort vergessen|Forgot password)$"\n    commands:\n      - tapOn: "^(Passwort vergessen|Forgot password)$"',
      );
    }
  });

  it('moves a persisted Dashboard session through the existing sign-out subflow', () => {
    const launch = readFlow(
      join(IOS_SUBFLOWS_ROOT, 'launch-local-dev-client-remote-preserve-state.yaml'),
    );
    const signOut = readFlow(join(IOS_SUBFLOWS_ROOT, 'sign-out.yaml'));
    const dashboardMarker = launch.indexOf('Übersicht|Overview');
    const signOutEntry = launch.indexOf(
      '- runFlow:\n    when:\n      visible: "^(Übersicht|Overview)$"\n    commands:\n      - runFlow: sign-out.yaml',
    );

    expect(dashboardMarker).toBeGreaterThanOrEqual(0);
    expect(signOutEntry).toBeGreaterThan(dashboardMarker);
    expect(signOut).toContain('id: "navigation-menu-open"');
    expect(signOut).toContain('id: "settings-sign-out"');
    expect(signOut).toContain('id: "sign-in-email"');
  });

  it('keeps local Mailpit recovery separate from explicit remote iOS journeys', () => {
    const localFlow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'password-reset.yaml'));
    const localHelper = readFlow(
      join(REPO_ROOT, '.maestro', 'scripts', 'auth', 'read-local-password-recovery-code.js'),
    );

    expect(localFlow).toContain('read-local-password-recovery-code.js');
    expect(localHelper).toContain('http://127.0.0.1:54324/api/v1/');
    expect(localFlow).not.toContain('read-remote-password-recovery.js');

    for (const [fileName, mode] of [
      ['password-reset-remote-link.yaml', 'link'],
      ['password-reset-remote-code.yaml', 'code'],
    ] as const) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', fileName));

      expect(flow).toContain('appId: com.goldjunge91.fam1');
      expect(flow).toContain('tags:\n  - remote-recovery\n  - ios-only');
      expect(flow).toContain('read-remote-password-recovery.js');
      expect(flow).toContain(`TEST_EMAIL: ${TEST_EMAIL_PLACEHOLDER}`);
      expect(flow).toContain(`REMOTE_CONFIRMED_EMAIL: ${REMOTE_CONFIRMED_EMAIL_PLACEHOLDER}`);
      expect(flow).toContain('RECOVERY_MODE: "preflight"');
      expect(flow).toContain(`CONFIRMED_RECOVERY_EMAIL: "${REMOTE_CONFIRMED_EMAIL_PLACEHOLDER}"`);
      expect(flow).toContain(`TEST_EMAIL: "${TEST_EMAIL_PLACEHOLDER}"`);
      expect(flow).toContain(`RECOVERY_EMAIL: "${REMOTE_CONFIRMED_EMAIL_PLACEHOLDER}"`);
      expect(flow).toContain(`RECOVERY_MODE: "${mode}"`);
      expect(flow).toContain(`RECOVERY_EMAIL: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`);
      expect(flow).toContain(`RECOVERY_REQUEST_STARTED_AT: "${REMOTE_REQUEST_STARTED_OUTPUT}"`);
      expect(flow).toContain(`inputText: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`);
      expect(flow).toMatch(/^[ ]{2}TEST_EMAIL: ["']?\$\{TEST_EMAIL\}["']?$/m);
      expect(flow).toMatch(
        /^[ ]{2}MAILOSAUR_SERVER_DOMAIN: ["']?\$\{MAILOSAUR_SERVER_DOMAIN \|\| ["']opbingdz\.mailosaur\.net["']\}["']?$/m,
      );
      expect(flow).toMatch(/^[ ]{2}RESET_PASSWORD: ["']?\$\{RESET_PASSWORD\}["']?$/m);
      expect(flow).not.toContain('MAILOSAUR_API_KEY');
      expect(flow).toContain('MAILOSAUR_SENDER: ${' + 'MAILOSAUR_SENDER || ""}');
      expect(flow).toContain('MAILOSAUR_SENDER: "${' + 'MAILOSAUR_SENDER}"');
      expect(flow).toMatch(
        /^[ ]{2}MAILOSAUR_SERVER_ID: ["']?\$\{MAILOSAUR_SERVER_ID \|\| ["']opbingdz["']\}["']?$/m,
      );
      expect(flow).not.toContain(REMOTE_EMAIL_OUTPUT);
      expect(flow).not.toContain(MAILOSAUR_ADDRESS_SUFFIX_PLACEHOLDER);
      const preflightIndex = flow.indexOf('RECOVERY_MODE: "preflight"');
      const appStartIndex = flow.indexOf(REMOTE_LAUNCH_SUBFLOW);
      expect(preflightIndex).toBeGreaterThanOrEqual(0);
      expect(preflightIndex).toBeLessThan(appStartIndex);
      expect(flow).not.toMatch(/\$\{(?:TEST_EMAIL|RESET_PASSWORD|MAILOSAUR_API_KEY)\s*\|\|/);
      expect(flow).not.toContain(MAILOSAUR_ADDRESS_SUFFIX_PLACEHOLDER);
      expect(flow).not.toContain(`RECOVERY_REQUEST_STARTED_AT: \${RECOVERY_REQUEST_STARTED_AT}`);
      expect(flow).not.toContain(`${TEST_EMAIL_PLACEHOLDER} ||`);
      expect(flow).not.toContain(MAILOSAUR_ADDRESS_TYPO);
      expect(flow).toContain(`inputText: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`);
      expect(flow).toContain(`RECOVERY_EMAIL: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`);
      expect(flow).not.toContain('read-local-password-recovery-code.js');
      expect(flow).not.toContain('127.0.0.1:54324');
      expect(flow).not.toContain('clearState');
      expect(flow).not.toContain('launchApp');
      expect(flow).not.toContain('stopApp');
      expect(flow).toContain('tapOn: "^(Code anfordern|Request code)$"');
      expect(flow).toContain('id: "recovery-new-password"');
      expect(flow).toContain('id: "recovery-password-confirmation"');
      expect(flow).toContain('visible: "^(Passwort geändert|Password changed)$"');
      expect(flow).toMatch(/assertVisible: "\^\(Übersicht\|Overview\)\$"/);

      if (mode === 'link') {
        expect(flow).toContain('openLink:');
        expect(flow).toContain(`link: "${RECOVERY_LINK_OUTPUT}"`);
        expect(flow).toContain(`visible: '^(Open in "fam"|In .* öffnen\\?)$'`);
        expect(flow).toContain('point: "67%,54%"');
        expect(flow).toContain('E-Mail-Code eingeben');
        expect(flow).toContain('output.recoveryLink');
      } else {
        expect(flow).toContain('Code in der App eingeben');
        expect(flow).toContain('id: "password-recovery-code"');
        expect(flow).toContain('id: "password-recovery-code"');
        expect(flow).toContain(`inputText: "${RECOVERY_CODE_OUTPUT}"`);
        expect(flow).not.toContain('output.recoveryLink');
      }
    }
  });

  it('replaces each remote recovery field with the full handoff without iOS text menus', () => {
    for (const fileName of ['password-reset-remote-link.yaml', 'password-reset-remote-code.yaml']) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', fileName));

      for (const fieldId of ['forgot-password-email', 'password-recovery-email']) {
        const fieldStart = flow.indexOf(`- tapOn:\n          id: "${fieldId}"`);
        const evalEnd = flow.indexOf('- evalScript:', fieldStart);
        const scriptEnd = flow.indexOf('- runScript:', fieldStart);
        const fieldEnd =
          evalEnd === -1 || (scriptEnd !== -1 && scriptEnd < evalEnd) ? scriptEnd : evalEnd;
        const fieldCommands = flow.slice(fieldStart, fieldEnd);

        const commandLines = fieldCommands
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const expectedReplacement = Array.from({ length: 4 }, () => [
          '- tapOn:',
          `id: "${fieldId}"`,
          '- eraseText: 100',
        ]).flat();

        expect(fieldStart).toBeGreaterThanOrEqual(0);
        expect(commandLines).toEqual([
          ...expectedReplacement,
          `- inputText: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`,
          `- assertVisible: "${CONFIRMED_REMOTE_EMAIL_OUTPUT}"`,
        ]);
        expect(fieldCommands).not.toContain('longPressOn');
        expect(fieldCommands).not.toContain('Select All');
        expect(fieldCommands).not.toContain('Alles auswählen');
        expect(fieldCommands).not.toContain('setClipboard');
        expect(fieldCommands).not.toContain('pasteText');
      }
    }
  });

  it.each(['password-reset-remote-code.yaml', 'password-reset-remote-link.yaml'])(
    'supports every independent remote recovery start state in %s',
    (fileName) => {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', fileName));
      const launch = readFlow(
        join(IOS_SUBFLOWS_ROOT, 'launch-local-dev-client-remote-preserve-state.yaml'),
      );
      const visibleStates = [
        'Übersicht',
        'Anmelden',
        'E-Mail unterwegs',
        'E-Mail-Code eingeben',
        'Neues Passwort',
      ];

      expect(launch).toContain("visible: '^(Willkommen|");
      for (const state of visibleStates) {
        expect(launch).toContain(state);
      }

      expect(flow).toContain(REMOTE_LAUNCH_SUBFLOW);
      expect(flow).toContain('visible: "^(Anmelden|Sign in|Passwort vergessen|Forgot password)$"');
      expect(flow).toContain('visible: "^(E-Mail unterwegs|Email on its way)$"');
      expect(flow).toContain('visible: "^(E-Mail-Code eingeben|Enter email code)$"');
      expect(flow).toContain('visible: "^(Neues Passwort|New password)$"');
      expect(flow).not.toMatch(/when:\n\s+visible:\n\s+id:/);
      expect(flow).not.toContain('setClipboard:');
      expect(flow).not.toContain('pasteText');
      expect(flow).not.toContain('clearState: true');

      const launchIndex = flow.indexOf(REMOTE_LAUNCH_SUBFLOW);
      const signInIndex = flow.indexOf(
        'visible: "^(Anmelden|Sign in|Passwort vergessen|Forgot password)$"',
      );
      const recoveryFormIndex = flow.indexOf('visible: "^(Passwort zurücksetzen|Reset password)$"');
      const newPasswordIndex = flow.indexOf('visible: "^(Neues Passwort|New password)$"');
      const dashboardIndex = launch.indexOf('visible: "^(Übersicht|Overview)$"');

      expect(launchIndex).toBeGreaterThanOrEqual(0);
      expect(signInIndex).toBeGreaterThan(launchIndex);
      expect(recoveryFormIndex).toBeGreaterThan(signInIndex);
      expect(newPasswordIndex).toBeGreaterThanOrEqual(0);
      expect(dashboardIndex).toBeGreaterThanOrEqual(0);
      expect(launch).toContain('- runFlow: sign-out.yaml');
    },
  );

  it('keeps remote Mailosaur signup explicitly iOS-only and opt-in', () => {
    const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'registration-remote-mailosaur.yaml'));

    expect(flow).toContain('appId: com.goldjunge91.fam1');
    expect(flow).toContain('tags:\n  - remote-setup\n  - ios-only');
    expect(flow).toContain(`MAILOSAUR_API_KEY: \${MAILOSAUR_API_KEY}`);
    expect(flow).toContain(`MAILOSAUR_SERVER_ID: \${MAILOSAUR_SERVER_ID || "opbingdz"}`);
    expect(flow).toContain(
      `MAILOSAUR_SERVER_DOMAIN: \${MAILOSAUR_SERVER_DOMAIN || "opbingdz.mailosaur.net"}`,
    );
    expect(flow).toContain(
      `MAILOSAUR_ADDRESS_SUFFIX: \${MAILOSAUR_ADDRESS_SUFFIX || "@opbingdz.mailosaur.net"}`,
    );
    expect(flow).toContain(`TEST_EMAIL: \${TEST_EMAIL || ""}`);
    expect(flow).toContain(`TEST_EMAIL: "\${TEST_EMAIL}"`);
    expect(flow).toContain(`TEST_PASSWORD: \${TEST_PASSWORD || ""}`);
    expect(flow).toContain('generate-remote-signup-password.js');
    expect(flow.match(/- inputText: "\${output\.remoteSignupPassword}"/g)).toHaveLength(2);
    expect(flow).not.toContain(`inputText: "\${TEST_PASSWORD}"`);
    expect(flow).toContain('RECOVERY_MODE: "address"');
    expect(flow).toContain(`- inputText: "\${output.testEmail}"`);
    expect(flow).toContain(`SIGNUP_EMAIL: "${REMOTE_EMAIL_OUTPUT}"`);
    expect(flow).toContain('REMOTE_CONFIRMED_EMAIL');
    expect(flow).toContain(
      'After either signup OTP acceptance or direct Hosted-Supabase confirmation',
    );
    expect(flow).toContain(
      'visible: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*)$"',
    );
    expect(flow).toContain(
      'text: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*)$"',
    );
    expect(flow).toContain('assertNotVisible:');
    expect(flow).toContain('visible: "Bestätigung ausstehend"');
    expect(flow).toContain(
      '- extendedWaitUntil:\n    visible: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*|Bestätigung ausstehend|Dein Profil)$"\n    timeout: 30000',
    );
    expect(flow).toContain(
      '- runScript:\n          file: ../../../scripts/auth/read-remote-signup-otp.js',
    );
    expect(flow).not.toContain('visible: "^(Bestätigung ausstehend|Später ausfüllen)$"');
    expect(flow).toContain(
      '- runFlow:\n    when:\n      visible: "Bestätigung ausstehend"\n    commands:',
    );
    expect(flow).not.toContain('MAILOSAUR_API_KEY ||');
    expect(flow).not.toContain('Passwort123!');
    expect(flow).not.toContain('clearState');
    expect(flow).not.toContain('127.0.0.1:54324');
    expect(flow).not.toContain('deleteUser');
    expect(flow).not.toContain('cleanup');
  });

  it('accepts direct hosted confirmation at the active-account onboarding step', () => {
    const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'registration-remote-mailosaur.yaml'));

    expect(flow).toContain(
      '- extendedWaitUntil:\n    visible: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*|Bestätigung ausstehend|Dein Profil)$"\n    timeout: 30000',
    );
    expect(flow).toContain(
      '- runFlow:\n    when:\n      visible: "Dein Profil"\n    commands:\n      - assertVisible: "Schritt 3 von 7"\n      - assertVisible: "Weiter"',
    );
    expect(flow).not.toContain('visible: "^(Bestätigung ausstehend|Später ausfüllen)$"');
    expect(flow).not.toContain('visible: "Später ausfüllen"\n    timeout: 30000');
  });

  it('waits for the signup response before checking duplicate or onboarding markers', () => {
    const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'registration-remote-mailosaur.yaml'));
    const submitIndex = flow.indexOf('- tapOn:\n    id: "sign-up-submit"');
    const responseWait = flow.indexOf(
      '- waitForAnimationToEnd\n- extendedWaitUntil:\n    visible: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*|Bestätigung ausstehend|Dein Profil)$"\n    timeout: 30000',
      submitIndex,
    );
    const duplicateGuard = flow.indexOf(
      '- runFlow:\n    when:\n      visible: "^(Für diese Adresse gibt es schon ein Konto.*|An account already exists for this address.*)$"',
      responseWait,
    );
    const pendingBranch = flow.indexOf(
      '- runFlow:\n    when:\n      visible: "Bestätigung ausstehend"',
      responseWait,
    );
    const profileBranch = flow.indexOf(
      '- runFlow:\n    when:\n      visible: "Dein Profil"',
      responseWait,
    );

    expect(submitIndex).toBeGreaterThanOrEqual(0);
    expect(responseWait).toBeGreaterThan(submitIndex);
    expect(duplicateGuard).toBeGreaterThan(responseWait);
    expect(pendingBranch).toBeGreaterThan(responseWait);
    expect(profileBranch).toBeGreaterThan(responseWait);
  });

  it('opens registration when remote setup starts on the sign-in screen', () => {
    const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'registration-remote-mailosaur.yaml'));
    const registrationEntry = flow.indexOf(
      "- runFlow:\n    when:\n      visible: '^(Noch kein Konto\\? Registrieren|No account yet\\? Sign up)$'\n    commands:\n      - tapOn:\n          text: '^(Noch kein Konto\\? Registrieren|No account yet\\? Sign up)$'",
    );
    const signUpEmail = flow.indexOf('- tapOn:\n    id: "sign-up-email"');

    expect(registrationEntry).toBeGreaterThanOrEqual(0);
    expect(registrationEntry).toBeLessThan(signUpEmail);
  });

  it('waits for the registration form after Welcome before remote signup starts', () => {
    const flow = readFlow(join(IOS_ROOT, 'flows', 'auth', 'registration-remote-mailosaur.yaml'));
    const welcomeTransition = flow.indexOf(
      '- runFlow:\n    when:\n      visible: "Willkommen"\n    commands:\n      - runFlow: ../../subflows/onboarding-welcome.yaml',
    );
    const registrationFormWait = flow.indexOf(
      '- extendedWaitUntil:\n    visible:\n      id: "sign-up-email"\n    timeout: 30000',
    );
    const signUpEmail = flow.indexOf('- tapOn:\n    id: "sign-up-email"');

    expect(welcomeTransition).toBeGreaterThanOrEqual(0);
    expect(registrationFormWait).toBeGreaterThan(welcomeTransition);
    expect(registrationFormWait).toBeLessThan(signUpEmail);
  });

  it('composes household fixture journeys from atomic iOS onboarding subflows', () => {
    for (const fileName of [
      'household-create-during-onboarding.yaml',
      'household-join-via-invite.yaml',
    ]) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'household', fileName));

      expect(flow).toContain('../../subflows/onboarding-welcome.yaml');
      expect(flow).toContain('../../subflows/onboarding-sign-in.yaml');
      expect(flow).toContain('../../subflows/onboarding-finish.yaml');
      expect(flow).toContain(`TEST_EMAIL: "${FIXTURE_EMAIL_PLACEHOLDER}"`);
      expect(flow).toContain(`TEST_PASSWORD: "${FIXTURE_PASSWORD_PLACEHOLDER}"`);
      expect(flow).not.toContain('onboarding-account-email');
      expect(flow).not.toContain('Anmelden & weiter');
    }
  });

  it('tags iOS session flows explicitly as local-session', () => {
    for (const fileName of ['sign-out-and-relaunch.yaml', 'session-persists-after-relaunch.yaml']) {
      const flow = readFlow(join(IOS_ROOT, 'flows', 'session', fileName));

      expect(flow).toContain('tags:\n  - local-session');
    }
  });

  it('retries welcome carousel taps while waiting for each page', () => {
    const welcome = readFlow(join(IOS_SUBFLOWS_ROOT, ATOMIC_SUBFLOWS.welcome));

    expect(welcome.match(/retryTapIfNoChange: true/g)).toHaveLength(2);
    expect(welcome.match(/waitToSettleTimeoutMs: 10000/g)).toHaveLength(2);
    expect(welcome).toContain('- waitForAnimationToEnd\n- tapOn:\n    point: "50%,60%"');
  });
});
