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
// Die Datei liegt im `_shared`-Ordner des siri-Targets: `@bacons/apple-targets`
// bindet dieses Verzeichnis in genau zwei Targets ein, die Haupt-App und die
// Siri-Extension. Ein globalses `targets/_shared` landet dagegen in ALLEN
// Extension-Targets, auch in `watch` — die Intent-Datei waere dort ohne Zweck
// und erzeugt mehrdeutige Build-Eintraege.
const MAIN_APP_INTENT_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  '_shared',
  'main-app-shopping-list-intent.swift',
);
const EXTENSION_ENTRYPOINT_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'siri-extension.swift');
const SIRI_TARGET_CONFIG_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'expo-target.config.js');
const APP_CONFIG_PATH = path.join(REPO_ROOT, 'app.config.ts');
const SHARED_APP_GROUP_PATH = path.join(REPO_ROOT, 'src', 'lib', 'apple', 'shared-app-group.ts');
const ENCRYPTION_PATH = path.join(REPO_ROOT, 'src', 'lib', 'db', 'local-database-encryption.ts');

/** Keychain-Gruppe: Team-ID + Bundle-ID, gedeckt durch `SW8RP7PA3W.*`. */
const FAM_KEYCHAIN_GROUP = 'SW8RP7PA3W.com.goldjunge91.fam1';

describe('Siri main-app intent convention', () => {
  it('keeps the native write owner shared while isolating the app-only shortcuts provider', () => {
    const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');
    const mainAppSource = fs.readFileSync(MAIN_APP_INTENT_PATH, 'utf8');

    expect(source).toContain('final class SiriShoppingDatabase');
    expect(source).toContain('struct AddShoppingListItemIntent: AppIntent');
    expect(source).toContain('static let openAppWhenRun = false');
    expect(source).not.toContain('MainAppAddShoppingListItemIntent');
    expect(source).not.toContain('OpenURLIntent');
    expect(source).not.toContain('@main');
    // Der Vor-Split-Klon `MainAppAddShoppingListItemIntent` ist entfernt; der
    // Provider referenziert nur noch den geteilten Intent.
    expect(mainAppSource).not.toContain('MainAppAddShoppingListItemIntent');
    expect(mainAppSource).toContain('struct FamMainAppShortcuts: AppShortcutsProvider');
    expect(mainAppSource).toContain('intent: AddShoppingListItemIntent()');
  });

  it('declares each app shortcut as a separate AppShortcutsBuilder expression', () => {
    const mainAppSource = fs.readFileSync(MAIN_APP_INTENT_PATH, 'utf8');

    expect(mainAppSource).toMatch(/static var appShortcuts: \[AppShortcut\] \{\s*AppShortcut\(/);
    expect(mainAppSource.match(/^\s*AppShortcut\(/gmu)).toHaveLength(1);
    expect(mainAppSource).not.toMatch(/static var appShortcuts: \[AppShortcut\] \{\s*\[/);
  });

  it('keeps den Extension-Einstiegspunkt getrennt vom geteilten Intent-Code', () => {
    const source = fs.readFileSync(EXTENSION_ENTRYPOINT_PATH, 'utf8');

    expect(source).toContain('@main');
    expect(source).toContain('FamAppIntentsExtension');
    expect(source).not.toContain('SiriShoppingDatabase');
  });

  it('teilt den SQLCipher-Schluessel ueber eine eigene Keychain-Access-Group', () => {
    // Die App Group ist ein eigenes Entitlement und macht ihre ID nicht
    // automatisch zur Keychain-Access-Group. Ohne `keychain-access-groups`
    // legt expo-secure-store den Schluessel unter der Bundle-ID-Gruppe des
    // Hauptprozesses ab; die Extension liest ihn dann nicht und der Schreib-
    // pfad scheitert mit SQLITE_NOTADB (`SQLite prepare`).
    const targetConfig = fs.readFileSync(SIRI_TARGET_CONFIG_PATH, 'utf8');
    const appConfig = fs.readFileSync(APP_CONFIG_PATH, 'utf8');

    expect(targetConfig).toContain('"keychain-access-groups"');
    expect(targetConfig).toContain(FAM_KEYCHAIN_GROUP);
    expect(targetConfig).not.toMatch(/\/\/\s*"keychain-access-groups"/u);

    // Schreibende Seite (Haupt-App) braucht dieselbe Gruppe.
    expect(appConfig).toContain("'keychain-access-groups'");
    expect(appConfig).toContain('keychainGroup');
  });

  it('nutzt fuer den Schluessel die Team-ID-Gruppe, nicht die App Group', () => {
    // `keychain-access-groups` im Profil lautet `SW8RP7PA3W.*`. Die App-Group
    // `group.*` faellt nicht darunter; Apple entfernt sie beim Signieren und
    // die `.xcent` bleibt leer. expo-secure-store reicht `accessGroup`
    // unveraendert durch, deshalb muss der volle Name hier stehen.
    const sharedAppGroup = fs.readFileSync(SHARED_APP_GROUP_PATH, 'utf8');
    const encryption = fs.readFileSync(ENCRYPTION_PATH, 'utf8');

    // Der Test prueft auf Quelltext, der selbst ein Template-Literal ist.
    // Deshalb escaped statt normal quoten: ein `${` in einem normalen String
    // waere ein Template-Platzhalter und wuerde den Wert zur Laufzeit loeschen.
    expect(sharedAppGroup).toContain(
      `FAM_KEYCHAIN_ACCESS_GROUP = \`\${FAM_TEAM_ID}.com.goldjunge91.fam1\``,
    );
    expect(sharedAppGroup).not.toContain('FAM_KEYCHAIN_ACCESS_GROUP = FAM_APP_GROUP');
    expect(encryption).toContain('accessGroup: FAM_KEYCHAIN_ACCESS_GROUP');
    // Die alte Aussage war falsch und hat den Bug beguenstigt.
    expect(encryption).not.toContain('The App Group is also a keychain access group');
  });

  it('setzt den Schluessel als PRAGMA, nicht ueber exsqlite3_key', () => {
    // `exsqlite3_key` erwartet Klartext und leitet per PBKDF2 ab; die
    // Haupt-App setzt `x'<hex>'` und erzwingt Raw-Key-Semantik. Beide Wege
    // ergeben unterschiedliche Schluessel — der falsche macht die Datei
    // unlesbar (SQLITE_NOTADB bei prepare_v2, "SQLite prepare").
    const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

    expect(source).toContain('static func keyPragma(for key: String) -> String');
    expect(source).toContain('PRAGMA key = \\"x\'\\(key)\'\\"');
    // Der Aufruf muss raus; nur der erklaerende Kommentar darf ihn nennen.
    expect(source).not.toMatch(/^\s*.*exsqlite3_key\(/mu);
  });

  it('liest den Schluessel zuerst aus dem Container, mit Keychain als Rueckfall', () => {
    // Der Datei-Spiegel traegt den Simulator, wo der Simulator nicht
    // signiert und Entitlements verwirft. Die Keychain bleibt Rueckfall.
    const sharedIntent = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

    expect(sharedIntent).toContain('static let databaseKeyFile = "fam.database.sqlcipher-key.v1"');
    expect(sharedIntent).toContain(
      'private func sharedDatabaseKey(in container: URL) throws -> String',
    );
    expect(sharedIntent).toContain('private func keychainDatabaseKey() throws -> String');
    expect(sharedIntent).toContain(
      'static let keychainAccessGroup = "SW8RP7PA3W.com.goldjunge91.fam1"',
    );
  });
});
