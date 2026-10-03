import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const databaseSource = fs.readFileSync(
  path.resolve(__dirname, '../../targets/siri/siri-shopping-list-database.swift'),
  'utf8',
);
const writerSource = fs.readFileSync(
  path.resolve(__dirname, '../../targets/siri/siri-shopping-list-database-writer.swift'),
  'utf8',
);
const intentSource = fs.readFileSync(
  path.resolve(__dirname, '../../targets/siri/siri-shopping-list-intents.swift'),
  'utf8',
);
const source = `${databaseSource}\n${writerSource}`;

// Execute the production resolver and statement wrapper against system SQLite.
// SQLCipher encryption and App Group access remain device acceptance checks.
const describeSwift = process.platform === 'darwin' ? describe : describe.skip;

describeSwift('Siri store resolution', () => {
  it('resolves only one active household store, including Unicode names', () => {
    const errors = source
      .slice(
        source.indexOf('enum SiriShoppingDatabaseError'),
        source.indexOf('final class SiriSQLiteStatement'),
      )
      .replace(', CustomLocalizedStringResourceConvertible', '');
    const statement = source.slice(
      source.indexOf('final class SiriSQLiteStatement'),
      source.indexOf('final class SiriShoppingDatabase'),
    );
    const resolver = source
      .slice(
        source.indexOf('    private func resolveStoreID('),
        source.indexOf('    private struct MergeableItem'),
      )
      .replace('private func', 'func');
    const program = `
import Foundation
import Security
import SQLite3
${errors}
${statement.replaceAll('exsqlite3_', 'sqlite3_')}
struct Resolver {
${resolver}
}
var handle: OpaquePointer?
precondition(sqlite3_open(":memory:", &handle) == SQLITE_OK)
let db = handle!
defer { sqlite3_close(db) }
func sql(_ sql: String) {
    precondition(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
}
sql("create table stores (id text, name text, household_id text, deleted_at integer)")
sql("insert into stores values ('a', 'Rewe', 'home', null), ('b', 'Rewe', 'other', null), ('c', 'Rewe', 'home', 1), ('d', 'Ökoladen', 'home', null)")
let resolver = Resolver()
let rewe = try resolver.resolveStoreID(named: "  REWE  ", householdID: "home", in: db)
precondition(rewe == "a")
let unicode = try resolver.resolveStoreID(named: "ökoladen", householdID: "home", in: db)
precondition(unicode == "d")
func expectMissing(_ name: String, household: String = "home") throws {
    do {
        _ = try resolver.resolveStoreID(named: name, householdID: household, in: db)
        fatalError("Expected missing store")
    } catch SiriShoppingDatabaseError.storeNotFound {}
}
try expectMissing("missing")
try expectMissing(" ")
try expectMissing("Rewe", household: "absent")
sql("insert into stores values ('e', 'Gelöscht', 'home', 1), ('f', 'Fremd', 'other', null)")
try expectMissing("Gelöscht")
try expectMissing("Fremd")
sql("insert into stores values ('g', ' rewe ', 'home', null)")
do {
    _ = try resolver.resolveStoreID(named: "Rewe", householdID: "home", in: db)
    fatalError("Expected ambiguous store")
} catch SiriShoppingDatabaseError.ambiguousStore {}
print("store-resolution-passed")
`;
    const output = execFileSync(
      'swift',
      [
        '-module-cache-path',
        path.resolve(__dirname, '../../build/cache/siri-swift-module-cache'),
        '-',
      ],
      { input: program, encoding: 'utf8', timeout: 120_000 },
    );
    expect(output).toContain('store-resolution-passed');
  }, 130_000);
});

describeSwift('Siri atomic shopping batch', () => {
  it('preserves list boundaries and rolls back items, outbox and history together', () => {
    const parserSource = fs.readFileSync(
      path.resolve(__dirname, '../../targets/siri/SiriShoppingItemParser.swift'),
      'utf8',
    );
    const databaseProgramSource =
      `${parserSource}\n${databaseSource}\n${writerSource}\n${intentSource.slice(0, intentSource.indexOf('struct AddShoppingListItemsIntent'))}`
        .replace('internal import ExpoSQLite', 'import SQLite3')
        .replace(', CustomLocalizedStringResourceConvertible', '')
        .replace('private func write(', 'func write(');
    const migrations = [
      '../../drizzle/local/20260826200344_worthless_celestials/migration.sql',
      '../../drizzle/local/20260924140706_lazy_anthem/migration.sql',
    ]
      .map((file) => fs.readFileSync(path.resolve(__dirname, file), 'utf8'))
      .join('\n');
    const tables = ['stores', 'shopping_list_items', 'outbox', 'outbox_history'];
    const schema = tables
      .map((table) => {
        const statement = migrations.match(
          new RegExp(`CREATE TABLE \x60${table}\x60 \\([\\s\\S]*?\\n\\);`),
        )?.[0];
        if (!statement) throw new Error(`Missing schema: ${table}`);
        return statement;
      })
      .join('\n');
    const program = `${databaseProgramSource}
var handle: OpaquePointer?
precondition(sqlite3_open(":memory:", &handle) == SQLITE_OK)
let db = handle!
defer { sqlite3_close(db) }
func sql(_ sql: String) {
    precondition(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
}
func scalar(_ sql: String) throws -> Int64 {
    let statement = try SiriSQLiteStatement(database: db, sql: sql)
    let result = try statement.step()
    precondition(result == 100)
    return statement.integer(at: 0)
}
sql(#"""
${schema}
"""#)
sql("insert into stores (id, household_id, name, color, updated_at) values ('a', 'home', 'Rewe', 'red', 0), ('b', 'home', 'Lidl', 'red', 0)")
let writer = SiriShoppingDatabase()
let parsed = try SiriShoppingDatabase.parseItems("Wurst, Marmelade und Käse")
precondition(parsed == ["Wurst", "Marmelade", "Käse"])
let multiword = try SiriShoppingDatabase.parseItems("Rote Paprika; Hafer Milch UND Brot")
precondition(multiword == ["Rote Paprika", "Hafer Milch", "Brot"])
for invalid in ["", "Milch,,Brot", "Milch und "] {
    do { _ = try SiriShoppingDatabase.parseItems(invalid); fatalError("Expected invalid items") }
    catch SiriShoppingDatabaseError.invalidItemList {}
}
try writer.write(items: ["Milch"], storeName: nil, householdID: "home", in: db)
try writer.write(items: ["Milch"], storeName: "Lidl", householdID: "home", in: db)
try writer.write(items: parsed, storeName: "Rewe", householdID: "home", in: db)
try writer.write(items: ["Milch", "Milch"], storeName: "Rewe", householdID: "home", in: db)
let reweCount = try scalar("select count(*) from shopping_list_items where store_id = 'a'")
precondition(reweCount == 4)
let quantity = try scalar("select quantity from shopping_list_items where store_id = 'a' and name = 'Milch'")
precondition(quantity == 2)
let otherQuantity = try scalar("select sum(quantity) from shopping_list_items where store_id is null or store_id = 'b'")
precondition(otherQuantity == 2)
let scopedPayloads = try scalar("select count(*) from outbox where json_extract(payload, '$.store_id') = 'a'")
precondition(scopedPayloads == 5)
let updatePayloads = try scalar("select count(*) from outbox where op = 'update' and json_extract(payload, '$.store_id') = 'a' and json_extract(payload, '$.quantity') = 2")
precondition(updatePayloads == 1)
let initialItems = try scalar("select count(*) from shopping_list_items")
let initialOutbox = try scalar("select count(*) from outbox")
let initialHistory = try scalar("select count(*) from outbox_history")
precondition(initialOutbox == 7 && initialHistory == 7)
sql("create trigger fail_history before insert on outbox_history when json_extract(NEW.payload, '$.name') = 'Fail' begin select raise(ABORT, 'injected failure'); end")
do {
    try writer.write(items: ["Milch", "Brot", "Fail"], storeName: "Rewe", householdID: "home", in: db)
    fatalError("Expected rollback")
} catch SiriShoppingDatabaseError.sqlite {}
let afterItems = try scalar("select count(*) from shopping_list_items")
let afterOutbox = try scalar("select count(*) from outbox")
let afterHistory = try scalar("select count(*) from outbox_history")
let afterQuantity = try scalar("select quantity from shopping_list_items where store_id = 'a' and name = 'Milch'")
precondition(afterItems == initialItems && afterOutbox == initialOutbox && afterHistory == initialHistory && afterQuantity == 2)
do {
    try writer.write(items: ["Brot"], storeName: "Missing", householdID: "home", in: db)
    fatalError("Expected missing store")
} catch SiriShoppingDatabaseError.storeNotFound {}
sql("insert into stores (id, household_id, name, color, updated_at) values ('c', 'home', 'Rewe', 'red', 0)")
do {
    try writer.write(items: ["Brot"], storeName: "Rewe", householdID: "home", in: db)
    fatalError("Expected ambiguous store")
} catch SiriShoppingDatabaseError.ambiguousStore {}
let finalOutbox = try scalar("select count(*) from outbox")
precondition(finalOutbox == initialOutbox)
precondition(sqlite3_get_autocommit(db) == 1)
print("batch-passed")
`;
    const output = execFileSync(
      'swift',
      [
        '-module-cache-path',
        path.resolve(__dirname, '../../build/cache/siri-swift-module-cache'),
        '-',
      ],
      { input: program, encoding: 'utf8', timeout: 120_000 },
    );
    expect(output).toContain('batch-passed');
  }, 130_000);
});
