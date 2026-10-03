import Foundation
import SQLite3
import Testing
@testable import FamSiri

@Suite("Siri shopping-list database writes")
struct SiriShoppingDatabaseWriteTests {
    @Test("offers only active stores from the selected household and matches spoken names")
    func listsActiveStoresForEntityQueries() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('rewe', 'home', 'Rewe', 'red', 0), ('lidl', 'home', 'Lidl', 'blue', 0), "
                + "('other', 'elsewhere', 'Rewe', 'red', 0), "
                + "('deleted', 'home', 'Rewe Alt', 'red', 0)",
        )
        try database.execute("update stores set deleted_at = 1 where id = 'deleted'")

        let allStores = try SiriShoppingDatabase().stores(
            matching: nil,
            householdID: "home",
            in: database.handle,
        )
        let matchingStores = try SiriShoppingDatabase().stores(
            matching: "REW",
            householdID: "home",
            in: database.handle,
        )

        #expect(allStores.map(\.id) == ["lidl", "rewe"])
        #expect(matchingStores.map(\.id) == ["rewe"])
    }

    @Test("writes to an entity ID only while it remains active in the selected household")
    func writesToSelectedStoreID() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('rewe', 'home', 'Rewe', 'red', 0), ('other', 'elsewhere', 'Rewe', 'red', 0), "
                + "('deleted', 'home', 'Rewe Alt', 'red', 0)",
        )
        try database.execute("update stores set deleted_at = 1 where id = 'deleted'")

        try SiriShoppingDatabase().write(
            items: ["Siri-Apfel"],
            storeID: "rewe",
            householdID: "home",
            in: database.handle,
        )

        #expect(try database.scalar("select count(*) from shopping_list_items where store_id = 'rewe'") == 1)
        #expect(try database.scalar("select count(*) from outbox where json_extract(payload, '$.store_id') = 'rewe'") == 1)
    }

    @Test("rejects a selected store ID after it leaves the active household")
    func rejectsStaleStoreEntityIDs() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('other', 'elsewhere', 'Rewe', 'red', 0), ('deleted', 'home', 'Rewe Alt', 'red', 0)",
        )
        try database.execute("update stores set deleted_at = 1 where id = 'deleted'")

        for storeID in ["other", "deleted", "missing"] {
            #expect(throws: SiriShoppingDatabaseError.self) {
                try SiriShoppingDatabase().write(
                    items: ["Siri-Apfel"],
                    storeID: storeID,
                    householdID: "home",
                    in: database.handle,
                )
            }
        }

        #expect(try database.scalar("select count(*) from shopping_list_items") == 0)
        #expect(try database.scalar("select count(*) from outbox") == 0)
        #expect(try database.scalar("select count(*) from outbox_history") == 0)
    }

    @Test("writes every item and outbox row to the named household store")
    func writesBatchToTheSelectedStore() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('rewe', 'home', 'Rewe', 'red', 0), ('lidl', 'home', 'Lidl', 'blue', 0), "
                + "('other', 'elsewhere', 'Rewe', 'red', 0)",
        )

        try SiriShoppingDatabase().write(
            items: ["Siri-Apfel", "Siri-Brot", "Siri-Milch"],
            storeName: " rewe ",
            householdID: "home",
            in: database.handle,
        )

        #expect(try database.scalar("select count(*) from shopping_list_items") == 3)
        #expect(try database.scalar("select count(*) from shopping_list_items where store_id = 'rewe'") == 3)
        #expect(try database.scalar("select count(*) from shopping_list_items where store_id != 'rewe'") == 0)
        #expect(try database.scalar("select count(*) from outbox") == 3)
        #expect(try database.scalar("select count(*) from outbox_history") == 3)
        #expect(
            try database.scalar(
                "select count(*) from outbox where json_extract(payload, '$.store_id') = 'rewe'",
            ) == 3,
        )
    }

    @Test("merges an existing item and queues the updated quantity")
    func mergesExistingItemsIntoTheSelectedStore() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values ('rewe', 'home', 'Rewe', 'red', 0)",
        )
        try database.execute(
            "insert into shopping_list_items (id, household_id, name, quantity, unit, sort_index, updated_at, store_id, recipe_names) "
                + "values ('apple', 'home', 'Apfel', 2, 'piece', 0, 0, 'rewe', '[\"Kuchen\"]')",
        )

        try SiriShoppingDatabase().write(
            items: ["Apfel", "Brot"],
            storeName: "Rewe",
            householdID: "home",
            in: database.handle,
        )

        #expect(try database.scalar("select cast(quantity as integer) from shopping_list_items where id = 'apple'") == 3)
        #expect(try database.scalar("select count(*) from shopping_list_items where household_id = 'home' and store_id = 'rewe'") == 2)
        #expect(try database.scalar("select count(*) from shopping_list_items where id = 'apple' and recipe_names = '[\"Kuchen\"]'") == 1)
        #expect(try database.scalar("select count(*) from outbox where entity_id = 'apple' and op = 'update'") == 1)
        #expect(try database.scalar("select cast(json_extract(payload, '$.quantity') as integer) from outbox where entity_id = 'apple'") == 3)
        #expect(try database.scalar("select count(*) from outbox where op = 'insert'") == 1)
        #expect(try database.scalar("select count(*) from outbox_history") == 2)
    }

    @Test("rolls back item and outbox writes when a later item fails")
    func rollsBackTheEntireBatchAfterAnInsertFails() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "create trigger reject_siri_item before insert on shopping_list_items "
                + "when new.name = 'Siri-Trigger-Fehler' begin select raise(abort, 'test failure'); end",
        )

        #expect(throws: SiriShoppingDatabaseError.self) {
            try SiriShoppingDatabase().write(
                items: ["Siri-Gültig", "Siri-Trigger-Fehler"],
                storeName: nil,
                householdID: "home",
                in: database.handle,
            )
        }

        #expect(try database.scalar("select count(*) from shopping_list_items") == 0)
        #expect(try database.scalar("select count(*) from outbox") == 0)
        #expect(try database.scalar("select count(*) from outbox_history") == 0)
    }

    @Test("does not merge an equal item from a different store")
    func keepsEqualItemsScopedToTheirStore() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('rewe', 'home', 'Rewe', 'red', 0), ('lidl', 'home', 'Lidl', 'blue', 0)",
        )
        try database.execute(
            "insert into shopping_list_items (id, household_id, name, quantity, unit, sort_index, updated_at, store_id) "
                + "values ('lidl-apple', 'home', 'Apfel', 2, 'piece', 0, 0, 'lidl')",
        )

        try SiriShoppingDatabase().write(
            items: ["Apfel"],
            storeName: "Rewe",
            householdID: "home",
            in: database.handle,
        )

        #expect(try database.scalar("select cast(quantity as integer) from shopping_list_items where id = 'lidl-apple'") == 2)
        #expect(try database.scalar("select count(*) from shopping_list_items where name = 'Apfel'") == 2)
        #expect(try database.scalar("select count(*) from shopping_list_items where name = 'Apfel' and store_id = 'rewe'") == 1)
        #expect(try database.scalar("select count(*) from outbox where op = 'insert'") == 1)
        #expect(try database.scalar("select count(*) from outbox_history") == 1)
    }

    @Test("rejects duplicate active store names without writing a batch")
    func rejectsAmbiguousStoreNamesAtomically() throws {
        let database = try SiriShoppingTestDatabase()
        try database.execute(
            "insert into stores (id, household_id, name, color, updated_at) values "
                + "('rewe-a', 'home', 'Rewe', 'red', 0), ('rewe-b', 'home', ' rewe ', 'blue', 0)",
        )

        #expect(throws: SiriShoppingDatabaseError.self) {
            try SiriShoppingDatabase().write(
                items: ["Apfel", "Brot"],
                storeName: "REWE",
                householdID: "home",
                in: database.handle,
            )
        }

        #expect(try database.scalar("select count(*) from shopping_list_items") == 0)
        #expect(try database.scalar("select count(*) from outbox") == 0)
        #expect(try database.scalar("select count(*) from outbox_history") == 0)
    }
}

private final class SiriShoppingTestDatabase {
    let handle: OpaquePointer

    init() throws {
        var database: OpaquePointer?
        guard sqlite3_open(":memory:", &database) == SQLITE_OK, let database else {
            throw SiriShoppingTestDatabaseError.open
        }
        handle = database

        do {
            for table in ["stores", "shopping_list_items", "outbox", "outbox_history"] {
                try execute(Self.schema(for: table))
            }
        } catch {
            sqlite3_close(database)
            throw error
        }
    }

    deinit {
        sqlite3_close(handle)
    }

    func execute(_ sql: String) throws {
        var message: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(handle, sql, nil, nil, &message) == SQLITE_OK else {
            defer { sqlite3_free(message) }
            throw SiriShoppingTestDatabaseError.execute(message.map { String(cString: $0) } ?? sql)
        }
    }

    func scalar(_ sql: String) throws -> Int64 {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw SiriShoppingTestDatabaseError.prepare(sql)
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else {
            throw SiriShoppingTestDatabaseError.step(sql)
        }
        return sqlite3_column_int64(statement, 0)
    }

    private static func schema(for table: String) throws -> String {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let migrations = [
            "drizzle/local/20260826200344_worthless_celestials/migration.sql",
            "drizzle/local/20260924140706_lazy_anthem/migration.sql",
        ]

        for migration in migrations {
            let source = try String(
                contentsOf: root.appendingPathComponent(migration),
                encoding: .utf8,
            )
            let prefix = "CREATE TABLE `\(table)` ("
            guard let start = source.range(of: prefix),
                  let end = source.range(of: "\n);", range: start.upperBound..<source.endIndex) else {
                continue
            }
            return String(source[start.lowerBound..<end.upperBound])
        }
        throw SiriShoppingTestDatabaseError.schema(table)
    }
}

private enum SiriShoppingTestDatabaseError: Error {
    case open
    case execute(String)
    case prepare(String)
    case step(String)
    case schema(String)
}
