import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHARED_INTENT_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  '_shared',
  'siri-shopping-list-intents.swift',
);
const MAIN_APP_INTENT_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri-main-app',
  'main-app-shopping-list-intent.swift',
);
const EXTENSION_ENTRYPOINT_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'siri-extension.swift');

describe('Siri main-app intent convention', () => {
  it('keeps the native write owner shared while isolating the app-only adapter', () => {
    const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');
    const mainAppSource = fs.readFileSync(MAIN_APP_INTENT_PATH, 'utf8');

    expect(source).toContain('final class SiriShoppingDatabase');
    expect(source).toContain('struct AddShoppingListItemIntent: AppIntent');
    expect(source).not.toContain('MainAppAddShoppingListItemIntent');
    expect(source).not.toContain('OpenURLIntent');
    expect(source).not.toContain('@main');
    expect(mainAppSource).toContain('struct MainAppAddShoppingListItemIntent: AppIntent');
    expect(mainAppSource).toContain('struct FamMainAppShortcuts: AppShortcutsProvider');
    expect(mainAppSource).toContain('static let openAppWhenRun = false');
  });

  it('declares each app shortcut as a separate AppShortcutsBuilder expression', () => {
    const mainAppSource = fs.readFileSync(MAIN_APP_INTENT_PATH, 'utf8');

    expect(mainAppSource).toMatch(/static var appShortcuts: \[AppShortcut\] \{\s*AppShortcut\(/);
    expect(mainAppSource.match(/^\s*AppShortcut\(/gmu)).toHaveLength(2);
    expect(mainAppSource).not.toMatch(/static var appShortcuts: \[AppShortcut\] \{\s*\[/);
  });

  it('keeps the existing extension entrypoint separate from shared intent code', () => {
    const source = fs.readFileSync(EXTENSION_ENTRYPOINT_PATH, 'utf8');

    expect(source).toContain('@main');
    expect(source).toContain('FamAppIntentsExtension');
    expect(source).not.toContain('SiriShoppingDatabase');
  });
});
