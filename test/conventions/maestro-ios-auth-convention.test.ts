import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const IOS_ROOT = join(REPO_ROOT, '.maestro', 'ios');
const IOS_SUBFLOWS_ROOT = join(IOS_ROOT, 'subflows');
const TEST_EMAIL_PLACEHOLDER = '${' + 'TEST_EMAIL}';
const TEST_PASSWORD_PLACEHOLDER = '${' + 'TEST_PASSWORD}';
const RESET_PASSWORD_PLACEHOLDER = '${' + 'RESET_PASSWORD}';
const WRONG_EMAIL_PLACEHOLDER = '${' + 'WRONG_EMAIL}';
const WRONG_PASSWORD_PLACEHOLDER = '${' + 'WRONG_PASSWORD}';
const FIXTURE_EMAIL_PLACEHOLDER = '${' + 'EMAIL}';
const FIXTURE_PASSWORD_PLACEHOLDER = '${' + 'PASSWORD}';
const RECOVERY_CODE_OUTPUT = '${' + 'output.recoveryCode}';
const TEST_ID_PREFIX_PLACEHOLDER = '${' + 'testIDPrefix}';
const METRO_URL_PLACEHOLDER = '${' + 'METRO_URL}';

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
        'setClipboard: "${output.auth.confirmationCode}"',
        '- pasteText',
        'id: "email-verification-code"',
        'assertTrue: ${output.confirmationCodeInput == output.auth.confirmationCode}',
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
