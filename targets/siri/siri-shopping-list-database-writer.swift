import Foundation
import os
#if canImport(ExpoSQLite)
internal import ExpoSQLite
#else
import SQLite3
#endif

// Store validation and item/outbox mutations share one transaction here.
extension SiriShoppingDatabase {
    // Resolve the list and write the entire batch under one write lock.
    // https://www.sqlite.org/lang_transaction.html
    func write(
        items: [String], storeName: String?, householdID: String, in database: OpaquePointer,
    ) throws {
        try write(items: items, householdID: householdID, in: database) {
            try storeName.map { try resolveStoreID(named: $0, householdID: householdID, in: database) }
        }
    }

    func write(
        items: [String], storeID: String?, householdID: String, in database: OpaquePointer,
    ) throws {
        try write(items: items, householdID: householdID, in: database) {
            try storeID.map { try resolveStoreID(id: $0, householdID: householdID, in: database) }
        }
    }

    private func write(
        items: [String], householdID: String, in database: OpaquePointer,
        resolveStore: () throws -> String?,
    ) throws {
        let now = Date()
        let timestamp = ISO8601DateFormatter().string(from: now)
        let timestampMs = Int64(now.timeIntervalSince1970 * 1000)

        // Item changes and their outbox history commit or roll back together.
        try execute("BEGIN IMMEDIATE", on: database)
        do {
            let storeID = try resolveStore()
            for item in items {
                let merge = try findMergeableItem(item, householdID: householdID, storeID: storeID, in: database)
                if let merge {
                    // Each repeated item in this batch increments the existing quantity once.
                    let mergedQuantity = merge.quantity + 1
                    let recipeNames = merge.recipeNames
                    try update(
                        database: database,
                        itemID: merge.id,
                        householdID: householdID,
                        storeID: storeID,
                        quantity: mergedQuantity,
                        recipeNames: recipeNames,
                        updatedAtMs: timestampMs,
                    )
                    let payload: [String: Any] = [
                        "id": merge.id,
                        "household_id": householdID,
                        "quantity": mergedQuantity,
                        "store_id": storeID ?? NSNull(),
                        "package_size": NSNull(),
                        "package_size_unit": NSNull(),
                        "recipe_names": recipeNames,
                        "category_id": merge.categoryID ?? NSNull(),
                        "category_source": merge.categorySource ?? NSNull(),
                        "category_classifier_version": merge.categoryClassifierVersion ?? NSNull(),
                        "updated_at": timestamp,
                    ]
                    try enqueue(
                        database: database,
                        entityID: merge.id,
                        operation: "update",
                        payload: payload,
                        timestampMs: timestampMs,
                    )
                } else {
                    let itemID = UUID().uuidString.lowercased()
                    let sortIndex = try nextSortIndex(householdID: householdID, storeID: storeID, in: database)
                    try insert(
                        database: database,
                        itemID: itemID,
                        householdID: householdID,
                        storeID: storeID,
                        name: item,
                        sortIndex: sortIndex,
                        createdAt: timestamp,
                        updatedAtMs: timestampMs,
                    )
                    let payload: [String: Any] = [
                        "id": itemID,
                        "household_id": householdID,
                        "product_id": NSNull(),
                        "name": item,
                        "quantity": 1,
                        "unit": "piece",
                        "package_size": NSNull(),
                        "package_size_unit": NSNull(),
                        "category_id": NSNull(),
                        "category_source": NSNull(),
                        "category_classifier_version": NSNull(),
                        "sort_index": sortIndex,
                        "store_id": storeID ?? NSNull(),
                        "price_estimate": NSNull(),
                        "recipe_names": [],
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    ]
                    try enqueue(
                        database: database,
                        entityID: itemID,
                        operation: "insert",
                        payload: payload,
                        timestampMs: timestampMs,
                    )
                }
            }
            try execute("COMMIT", on: database)
        } catch {
            // Ein fehlgeschlagenes ROLLBACK darf nicht unbeobachtet bleiben:
            // Dann bleibt die Transaktion offen, und nur das implizite
            // Rollback von `exsqlite3_close` rettet die Atomaritaet — ohne
            // Beleg. Der Originalfehler wird weiterhin propagiert, der
            // Rollback-Fehler zusaetzlich protokolliert.
            do {
                try execute("ROLLBACK", on: database)
            } catch {
                Self.logger.error("Siri rollback failed: \(String(describing: error), privacy: .public)")
            }
            throw error
        }
    }

    // Nur aktive Listen des aktiven Haushalts sind Kandidaten.
    // https://www.sqlite.org/lang_select.html#whereclause
    /// Name matching is case- and whitespace-insensitive, but duplicates stay an error.
    private func resolveStoreID(
        named rawName: String,
        householdID: String,
        in database: OpaquePointer,
    ) throws -> String {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !name.isEmpty else { throw SiriShoppingDatabaseError.storeNotFound }
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select id, name from stores where household_id = ? and deleted_at is null",
        )
        try statement.bind(1, text: householdID)
        var match: String?
        while try statement.step() == 100 {
            guard let id = statement.text(at: 0),
                  let candidate = statement.text(at: 1),
                  candidate.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == name else {
                continue
            }
            guard match == nil else { throw SiriShoppingDatabaseError.ambiguousStore }
            match = id
        }
        guard let match else { throw SiriShoppingDatabaseError.storeNotFound }
        return match
    }

    /// Revalidates Siri's selected ID against the current household and deletion state.
    private func resolveStoreID(
        id: String,
        householdID: String,
        in database: OpaquePointer,
    ) throws -> String {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select id from stores where id = ? and household_id = ? and deleted_at is null",
        )
        try statement.bind(1, text: id)
        try statement.bind(2, text: householdID)
        guard try statement.step() == 100, let activeID = statement.text(at: 0) else {
            throw SiriShoppingDatabaseError.storeNotFound
        }
        return activeID
    }

    private struct MergeableItem {
        let id: String
        let quantity: Double
        let recipeNames: [String]
        let categoryID: String?
        let categorySource: String?
        let categoryClassifierVersion: String?
    }

    /// Only active, unchecked piece items without product or package data can be merged.
    private func findMergeableItem(
        _ name: String,
        householdID: String,
        storeID: String?,
        in database: OpaquePointer,
    ) throws -> MergeableItem? {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: """
            select id, quantity, recipe_names, category_id, category_source, category_classifier_version
            from shopping_list_items
            where household_id = ? and deleted_at is null and checked_at is null
              and product_id is null and lower(trim(name)) = lower(trim(?))
              and unit = 'piece' and store_id is ? and package_size is null
              and package_size_unit is null
            limit 1
            """,
        )
        try statement.bind(1, text: householdID)
        try statement.bind(2, text: name)
        try statement.bind(3, text: storeID)
        guard try statement.step() == 100, let id = statement.text(at: 0) else { return nil }
        let recipeNames = statement.text(at: 2).flatMap { Self.decodeRecipeNames($0) } ?? []
        return MergeableItem(
            id: id,
            quantity: statement.number(at: 1),
            recipeNames: recipeNames,
            categoryID: statement.text(at: 3),
            categorySource: statement.text(at: 4),
            categoryClassifierVersion: statement.text(at: 5),
        )
    }

    /// `updated_at` ist im Drizzle-Schema `integer not null` in Epoch-
    /// Millisekunden (`mirrorColumns().updatedAt`) und wird so auch vom
    /// JS-Owner geschrieben. Der Outbox-Payload traegt dagegen die
    /// ISO-Zeichenkette, weil Supabase `timestamptz` erwartet — die beiden
    /// Formate gehoeren bewusst an verschiedene Ziele.
    private func update(
        database: OpaquePointer,
        itemID: String,
        householdID: String,
        storeID: String?,
        quantity: Double,
        recipeNames: [String],
        updatedAtMs: Int64,
    ) throws {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: """
            update shopping_list_items
            set quantity = ?, package_size = null, package_size_unit = null,
                recipe_names = ?, updated_at = ?, _dirty = 1
            where id = ? and household_id = ? and store_id is ?
            """,
        )
        try statement.bind(1, double: quantity)
        try statement.bind(2, text: Self.encodeJSON(recipeNames))
        try statement.bind(3, integer: updatedAtMs)
        try statement.bind(4, text: itemID)
        try statement.bind(5, text: householdID)
        try statement.bind(6, text: storeID)
        try requireExactlyOneRow(statement, on: database, operation: "update")
    }

    /// `created_at` ist laut Schema `text` und traegt daher die
    /// ISO-Zeichenkette; `updated_at` ist `integer` und traegt Epoch-
    /// Millisekunden. Der Outbox-Payload bleibt bei ISO, weil Supabase
    /// `timestamptz` erwartet.
    private func insert(
        database: OpaquePointer,
        itemID: String,
        householdID: String,
        storeID: String?,
        name: String,
        sortIndex: Int64,
        createdAt: String,
        updatedAtMs: Int64,
    ) throws {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: """
            insert into shopping_list_items
              (id, household_id, product_id, name, quantity, unit, package_size,
               package_size_unit, category_id, category_source,
               category_classifier_version, sort_index, store_id, price_estimate,
               recipe_names, created_at, updated_at, _dirty)
            values (?, ?, null, ?, 1, 'piece', null, null, null, null, null,
                    ?, ?, null, '[]', ?, ?, 1)
            """,
        )
        try statement.bind(1, text: itemID)
        try statement.bind(2, text: householdID)
        try statement.bind(3, text: name)
        try statement.bind(4, integer: sortIndex)
        try statement.bind(5, text: storeID)
        try statement.bind(6, text: createdAt)
        try statement.bind(7, integer: updatedAtMs)
        try requireExactlyOneRow(statement, on: database, operation: "insert")
    }

    /// `step()` meldet auch dann DONE, wenn ein UPDATE keine Zeile getroffen
    /// hat — `where id = ? and household_id = ?` kann still ins Leere laufen,
    /// etwa wenn der Artikel zwischenzeitlich geloescht wurde. Erst
    /// `exsqlite3_changes` trennt einen echten Treffer von einem Null-Treffer.
    private func requireExactlyOneRow(
        _ statement: SiriSQLiteStatement,
        on database: OpaquePointer,
        operation: String,
    ) throws {
        guard try statement.step() == 101 else {
            throw SiriShoppingDatabaseError.sqlite(operation: operation, message: "statement failed")
        }
        guard exsqlite3_changes(database) == 1 else {
            throw SiriShoppingDatabaseError.sqlite(
                operation: operation,
                message: "no row affected",
            )
        }
    }

    /// Allocates the next visible position within the same household and store.
    private func nextSortIndex(householdID: String, storeID: String?, in database: OpaquePointer) throws -> Int64 {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select coalesce(max(sort_index), -1) + 1 from shopping_list_items where household_id = ? and deleted_at is null and store_id is ?",
        )
        try statement.bind(1, text: householdID)
        try statement.bind(2, text: storeID)
        guard try statement.step() == 100 else { throw SiriShoppingDatabaseError.databaseUnavailable }
        return statement.integer(at: 0)
    }

    /// Queues the sync payload and its history row inside the caller's transaction.
    private func enqueue(
        database: OpaquePointer,
        entityID: String,
        operation: String,
        payload: [String: Any],
        timestampMs: Int64,
    ) throws {
        let payloadJSON = Self.encodeJSON(payload)
        let outboxStatement = try SiriSQLiteStatement(
            database: database,
            sql: "insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values ('shopping_list_items', ?, ?, ?, ?, 0, 0)",
        )
        try outboxStatement.bind(1, text: entityID)
        try outboxStatement.bind(2, text: operation)
        try outboxStatement.bind(3, text: payloadJSON)
        try outboxStatement.bind(4, integer: timestampMs)
        // `step()` wirft selbst, sobald SQLite einen Fehlercode liefert — eine
        // NOT-NULL- oder CHECK-Verletzung erreicht also nie diese Stelle. Ein
        // zusaetzlicher `guard step() == 101` koennte hier nur nie feuern und
        // waere toter Code. `requireExactlyOneRow` sichert dagegen das, was
        // `step()` nicht unterscheidet: ob wirklich eine Zeile entstanden ist.
        try requireExactlyOneRow(outboxStatement, on: database, operation: "outbox")

        let outboxID = exsqlite3_last_insert_rowid(database)
        let historyStatement = try SiriSQLiteStatement(
            database: database,
            sql: "insert into outbox_history (outbox_id, entity, entity_id, op, payload, created_at, status, attempts, updated_at) values (?, 'shopping_list_items', ?, ?, ?, ?, 'queued', 0, ?)",
        )
        try historyStatement.bind(1, integer: outboxID)
        try historyStatement.bind(2, text: entityID)
        try historyStatement.bind(3, text: operation)
        try historyStatement.bind(4, text: payloadJSON)
        try historyStatement.bind(5, integer: timestampMs)
        try historyStatement.bind(6, integer: timestampMs)
        try requireExactlyOneRow(historyStatement, on: database, operation: "outbox_history")
    }

}
