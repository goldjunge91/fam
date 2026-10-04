import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXTENSION_INTENT_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  'siri-shopping-list-intents.swift',
);
const DATABASE_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'siri-shopping-list-database.swift');
const DATABASE_WRITER_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  'siri-shopping-list-database-writer.swift',
);
const SHORTCUT_PROVIDER_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  'main-app-shopping-list-intent.swift',
);
const EXTENSION_ENTRYPOINT_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'siri-extension.swift');
const SIRI_TARGET_CONFIG_PATH = path.join(REPO_ROOT, 'targets', 'siri', 'expo-target.config.js');
const APP_CONFIG_PATH = path.join(REPO_ROOT, 'app.config.ts');
const APP_JSON_PATH = path.join(REPO_ROOT, 'app.json');
const SWIFT_PACKAGE_PATH = path.join(REPO_ROOT, 'Package.swift');
const SWIFT_PARSER_TEST_PATH = path.join(
  REPO_ROOT,
  'test',
  'swift',
  'siri-item-parser-tests',
  'SiriShoppingItemParserTests.swift',
);
const SWIFT_DATABASE_TEST_PATH = path.join(
  REPO_ROOT,
  'test',
  'swift',
  'siri-item-parser-tests',
  'SiriShoppingDatabaseWriteTests.swift',
);
const SHARED_APP_GROUP_PATH = path.join(REPO_ROOT, 'src', 'lib', 'apple', 'shared-app-group.ts');
const ENCRYPTION_PATH = path.join(REPO_ROOT, 'src', 'lib', 'db', 'local-database-encryption.ts');

/** Keychain-Gruppe: Team-ID + Bundle-ID, gedeckt durch `SW8RP7PA3W.*`. */
const FAM_KEYCHAIN_GROUP = 'SW8RP7PA3W.com.goldjunge91.fam1';

describe('Siri extension intent convention', () => {
  it('keeps intents, database access, and database writes in separate Swift files', () => {
    expect(fs.existsSync(DATABASE_PATH)).toBe(true);
    expect(fs.existsSync(DATABASE_WRITER_PATH)).toBe(true);

    const intentSource = fs.readFileSync(EXTENSION_INTENT_PATH, 'utf8');
    const databaseSource = fs.readFileSync(DATABASE_PATH, 'utf8');
    const writerSource = fs.readFileSync(DATABASE_WRITER_PATH, 'utf8');
    const swiftPackage = fs.readFileSync(SWIFT_PACKAGE_PATH, 'utf8');

    expect(intentSource).toContain('struct AddShoppingListItemsIntent: AppIntent');
    expect(intentSource).not.toContain('final class SiriShoppingDatabase');
    expect(databaseSource).toContain('final class SiriShoppingDatabase');
    expect(databaseSource).not.toContain('struct AddShoppingListItemsIntent: AppIntent');
    expect(writerSource).toContain('private func insert(');
    expect(swiftPackage).toContain('"siri-shopping-list-database.swift"');
    expect(swiftPackage).toContain('"siri-shopping-list-database-writer.swift"');
  });

  it('keeps the shopping intent and voice phrase provider exclusively in the extension', () => {
    const source = fs.readFileSync(DATABASE_PATH, 'utf8');
    const intentSource = fs.readFileSync(EXTENSION_INTENT_PATH, 'utf8');
    const mainAppSource = fs.readFileSync(SHORTCUT_PROVIDER_PATH, 'utf8');

    expect(
      fs.existsSync(path.join(REPO_ROOT, 'targets/siri/_shared/siri-shopping-list-intents.swift')),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(REPO_ROOT, 'targets/siri/_shared/main-app-shopping-list-intent.swift'),
      ),
    ).toBe(false);

    expect(source).toContain('final class SiriShoppingDatabase');
    expect(intentSource).not.toContain('struct AddShoppingListItemIntent: AppIntent');
    expect(intentSource).toContain('static let openAppWhenRun = false');
    expect(intentSource).not.toContain('MainAppAddShoppingListItemIntent');
    expect(intentSource).not.toContain('OpenURLIntent');
    expect(intentSource).not.toContain('@main');
    expect(mainAppSource).not.toContain('MainAppAddShoppingListItemIntent');
    expect(mainAppSource).toContain('struct FamMainAppShortcuts: AppShortcutsProvider');
    expect(mainAppSource).not.toContain('intent: AddShoppingListItemIntent()');
  });

  it('declares each app shortcut as a separate AppShortcutsBuilder expression', () => {
    const mainAppSource = fs.readFileSync(SHORTCUT_PROVIDER_PATH, 'utf8');

    expect(mainAppSource).toMatch(
      /static var appShortcuts: \[AppShortcut\] \{\s*(?:\/\/[^\n]*\s*)*AppShortcut\(/,
    );
    expect(mainAppSource.match(/^\s*AppShortcut\(/gmu)).toHaveLength(1);
    expect(mainAppSource).not.toMatch(/static var appShortcuts: \[AppShortcut\] \{\s*\[/);
  });

  it('registers natural voice phrases for single and batch additions on one intent', () => {
    const provider = fs.readFileSync(SHORTCUT_PROVIDER_PATH, 'utf8');
    const source = fs.readFileSync(EXTENSION_INTENT_PATH, 'utf8');
    const databaseSource = fs.readFileSync(DATABASE_PATH, 'utf8');
    const writerSource = fs.readFileSync(DATABASE_WRITER_PATH, 'utf8');
    const batch = source.slice(source.indexOf('struct AddShoppingListItemsIntent'));

    expect(provider).toContain('intent: AddShoppingListItemsIntent()');
    expect(source).not.toContain('struct AddShoppingListItemIntent: AppIntent');
    for (const phrase of [
      'Füge einen Artikel zur Einkaufsliste in \\(.applicationName) hinzu',
      'Füge einen Artikel mit \\(.applicationName) hinzu',
      'Setze mit \\(.applicationName) einen Artikel auf die Einkaufsliste',
      'Ergänze die Einkaufsliste mit \\(.applicationName)',
      'Füge mit \\(.applicationName) mehrere Artikel zur Einkaufsliste hinzu',
      'Füge mehrere Artikel zur Einkaufsliste in \\(.applicationName) hinzu',
      'Füge mehrere Artikel mit \\(.applicationName) hinzu',
      'Setze mehrere Artikel mit \\(.applicationName) auf die Einkaufsliste',
      'Packe mehrere Artikel mit \\(.applicationName) auf die Einkaufsliste',
      'Schreibe mit \\(.applicationName) etwas auf meine Einkaufsliste',
      'Trage mit \\(.applicationName) etwas auf die Einkaufsliste ein',
      'Ergänze meine Einkaufsliste mit \\(.applicationName)',
      'Setze mit \\(.applicationName) etwas auf meine Einkaufsliste',
      'Nimm mit \\(.applicationName) einen Artikel in die Einkaufsliste auf',
      'Packe mit \\(.applicationName) etwas auf meine Einkaufsliste',
      'Füge meiner Einkaufsliste mit \\(.applicationName) noch etwas hinzu',
      'Ich möchte mit \\(.applicationName) etwas zur Einkaufsliste hinzufügen',
    ]) {
      expect(provider).toContain(phrase);
    }
    expect(provider.match(/\\\(\.applicationName\)/gu)).toHaveLength(17);
    expect(batch).toContain('var items: String');
    expect(batch).toContain('var store: SiriShoppingStore');
    expect(batch).not.toContain('var storeName: String');
    expect(batch).toContain('query: SiriShoppingStoreQuery()');
    expect(batch).toContain(
      'requestDisambiguationDialog: "Welche dieser Einkaufslisten meinst du?"',
    );
    expect(batch).toContain('static var parameterSummary: some ParameterSummary');
    expect(batch).toContain('Summary("Füge \\(\\.$items) zur Einkaufsliste \\(\\.$store) hinzu")');
    expect(batch).toContain('requestValueDialog: "Was möchtest du hinzufügen?');
    expect(batch).toContain('requestValueDialog: "Welche Einkaufsliste?"');
    expect(batch).toContain('einen oder mehrere Artikel');
    expect(batch).toContain('static let openAppWhenRun = false');
    expect(source).toContain('struct SiriShoppingStore: AppEntity, Identifiable');
    expect(source).toContain('struct SiriShoppingStoreQuery: EntityStringQuery');
    expect(source).toContain('func suggestedEntities() async throws -> [SiriShoppingStore]');
    expect(source).toContain(
      'func entities(matching string: String) async throws -> [SiriShoppingStore]',
    );
    expect(databaseSource).toContain(
      'select id, name from stores where household_id = ? and deleted_at is null',
    );
    expect(writerSource).toContain(
      'select id from stores where id = ? and household_id = ? and deleted_at is null',
    );
    expect(provider).toContain('shortTitle: "Einkaufsartikel hinzufügen"');
    expect(batch).toContain('static var supportedModes: IntentModes { .background }');
    expect(batch).toContain('try SiriShoppingDatabase().add(items: items, toStoreID: store.id)');
    expect(batch).toContain('some IntentResult & ProvidesDialog & ReturnsValue<Int>');
    expect(batch).toContain('.result(value: count, dialog:');
    expect(batch).not.toContain('OpenURLIntent');
  });

  it('tests production Siri logic in Swift with an iOS 17 baseline and guarded iOS 26 APIs', () => {
    const swiftPackage = fs.readFileSync(SWIFT_PACKAGE_PATH, 'utf8');
    const parserTests = fs.readFileSync(SWIFT_PARSER_TEST_PATH, 'utf8');
    const databaseTests = fs.readFileSync(SWIFT_DATABASE_TEST_PATH, 'utf8');
    const config = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
    const source = fs.readFileSync(EXTENSION_INTENT_PATH, 'utf8');

    expect(swiftPackage).toContain('platforms: [.iOS(.v17), .macOS(.v13)]');
    expect(swiftPackage).toContain('"siri-shopping-list-database.swift"');
    expect(swiftPackage).toContain('"siri-shopping-list-database-writer.swift"');
    expect(swiftPackage).toContain('"siri-shopping-list-intents.swift"');
    expect(parserTests).toContain('import Testing');
    expect(databaseTests).toContain('import Testing');
    expect(databaseTests).toContain('SiriShoppingDatabase().write(');
    expect(databaseTests).toContain('rolls back item and outbox writes when a later item fails');
    expect(databaseTests).toContain('merges an existing item and queues the updated quantity');
    expect(parserTests).toContain('accepts a single item');
    expect(source).toContain('@available(iOS 17.0, *)\nstruct AddShoppingListItemsIntent');
    expect(source).toContain('@available(iOS 26.0, macOS 26.0, *)');
    expect(source).toContain('static var supportedModes: IntentModes { .background }');
    expect(config).not.toContain('withAppIntentsTesting');
    expect(fs.existsSync(path.join(REPO_ROOT, 'plugins', 'withAppIntentsTesting.js'))).toBe(false);
  });

  it('configures app-name synonyms in the main iOS app Info.plist', () => {
    const appConfig: unknown = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));

    expect(appConfig).toMatchObject({
      expo: {
        ios: {
          infoPlist: {
            CFBundleSpokenName: 'Famm',
            INAlternativeAppNames: [
              {
                INAlternativeAppName: 'Fam App',
                INAlternativeAppNamePronunciationHint: 'Famm App',
              },
              {
                INAlternativeAppName: 'Fam Einkauf',
                INAlternativeAppNamePronunciationHint: 'Famm Einkauf',
              },
              {
                INAlternativeAppName: 'Fam Liste',
                INAlternativeAppNamePronunciationHint: 'Famm Liste',
              },
            ],
          },
        },
      },
    });
  });

  it('keeps the extension entry point separate from the shopping intent', () => {
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
    const source = fs.readFileSync(DATABASE_PATH, 'utf8');

    expect(source).toContain('static func keyPragma(for key: String) -> String');
    expect(source).toContain('PRAGMA key = \\"x\'\\(key)\'\\"');
    // Der Aufruf muss raus; nur der erklaerende Kommentar darf ihn nennen.
    expect(source).not.toMatch(/^\s*.*exsqlite3_key\(/mu);
  });

  it('liest den Schluessel zuerst aus dem Container, mit Keychain als Rueckfall', () => {
    // Der Datei-Spiegel traegt den Simulator, wo der Simulator nicht
    // signiert und Entitlements verwirft. Die Keychain bleibt Rueckfall.
    const sharedIntent = fs.readFileSync(DATABASE_PATH, 'utf8');

    expect(sharedIntent).toContain('static let databaseKeyFile = "fam.database.sqlcipher-key.v1"');
    expect(sharedIntent).toContain(
      'private func sharedDatabaseKey(in container: URL, fileName: String) throws -> String',
    );
    expect(sharedIntent).toContain('private func keychainDatabaseKey() throws -> String');
    expect(sharedIntent).toContain(
      'static let keychainAccessGroup = "SW8RP7PA3W.com.goldjunge91.fam1"',
    );
  });
});
