import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const signInFlow = readFileSync(
  join(process.cwd(), '.maestro', 'ios', 'subflows', 'onboarding-sign-in.yaml'),
  'utf8',
);

describe('onboarding sign-in input contract', () => {
  it('uses clipboard paste for both credentials and verifies the CLI override before password entry', () => {
    const switchToSignInIndex = signInFlow.indexOf('- tapOn: "Ich habe schon ein Konto"');
    const emptyValueIndex = signInFlow.indexOf('- assertNotVisible: ".*@.*"');
    const emailClipboardIndex = signInFlow.indexOf('- setClipboard: "${TEST_EMAIL}"');
    const emailPasteIndex = signInFlow.indexOf('- pasteText', emailClipboardIndex);
    const exactCopyIndex = signInFlow.indexOf('- copyTextFrom:\n    id: "sign-in-email"');
    const exactValueIndex = signInFlow.indexOf(
      'assertTrue: ${output.signInEmail == TEST_EMAIL}',
      exactCopyIndex,
    );
    const passwordIndex = signInFlow.indexOf('id: "sign-in-password"');
    const passwordClipboardIndex = signInFlow.indexOf('- setClipboard: "${TEST_PASSWORD}"');
    const passwordPasteIndex = signInFlow.indexOf('- pasteText', passwordClipboardIndex);
    const hideKeyboardIndex = signInFlow.indexOf('- hideKeyboard');
    const submitIndex = signInFlow.indexOf('id: "sign-in-submit"');

    expect(signInFlow).not.toContain('inputText');
    expect(signInFlow).not.toContain('eraseText');
    expect(signInFlow).toContain('visible: "Ich habe schon ein Konto"');
    expect(emptyValueIndex).toBeGreaterThan(switchToSignInIndex);
    expect(emailClipboardIndex).toBeGreaterThan(emptyValueIndex);
    expect(emailPasteIndex).toBeGreaterThan(emailClipboardIndex);
    expect(exactCopyIndex).toBeGreaterThan(emailPasteIndex);
    expect(exactValueIndex).toBeGreaterThan(exactCopyIndex);
    expect(passwordIndex).toBeGreaterThan(exactValueIndex);
    expect(passwordClipboardIndex).toBeGreaterThan(passwordIndex);
    expect(passwordPasteIndex).toBeGreaterThan(passwordClipboardIndex);
    expect(hideKeyboardIndex).toBeGreaterThan(passwordPasteIndex);
    expect(submitIndex).toBeGreaterThan(hideKeyboardIndex);
  });
});
