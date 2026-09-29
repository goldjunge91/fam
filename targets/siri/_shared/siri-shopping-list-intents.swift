import AppIntents
internal import ExpoSQLite
import Foundation
import Security

enum SiriShoppingDatabaseError: LocalizedError {
    case appGroupUnavailable
    case databaseUnavailable
    case databaseKeyUnavailable
    case missingActiveHousehold
    case invalidItem
    case sqlite(operation: String, message: String)

    var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "fam ist für Siri noch nicht eingerichtet. Öffne fam einmal und versuche es erneut."
        case .databaseUnavailable:
            return "Die lokale Einkaufsliste ist noch nicht bereit. Öffne fam einmal und versuche es erneut."
        case .databaseKeyUnavailable:
            return "Die lokale Einkaufsliste kann nicht entsperrt werden. Öffne fam einmal und versuche es erneut."
        case .missingActiveHousehold:
            return "Melde dich in fam an und wähle einen aktiven Haushalt aus."
        case .invalidItem:
            return "Bitte nenne einen gültigen Artikel."
        case let .sqlite(operation, message):
            return "Die Einkaufsliste konnte nicht gespeichert werden (\(operation): \(message))."
        }
    }
}

final class SiriSQLiteStatement {
    private let database: OpaquePointer
    private var statement: OpaquePointer?
    private var textBindings: [UnsafeMutablePointer<CChar>] = []

    init(database: OpaquePointer, sql: String) throws {
        self.database = database
        var prepared: OpaquePointer?
        let result = sql.withCString { sqlPointer in
            exsqlite3_prepare_v2(database, sqlPointer, -1, &prepared, nil)
        }
        guard result == 0, let prepared else {
            throw SiriShoppingDatabaseError.sqlite(
                operation: "prepare",
                message: Self.message(for: database),
            )
        }
        statement = prepared
    }

    deinit {
        if let statement {
            exsqlite3_finalize(statement)
        }
        textBindings.forEach { $0.deallocate() }
    }

    func bind(_ index: Int32, text: String) throws {
        guard let statement else { throw SiriShoppingDatabaseError.databaseUnavailable }
        let bytes = Array(text.utf8)
        guard let byteCount = Int32(exactly: bytes.count) else {
            throw SiriShoppingDatabaseError.databaseUnavailable
        }
        let value = UnsafeMutablePointer<CChar>.allocate(capacity: bytes.count + 1)
        for (offset, byte) in bytes.enumerated() {
            value[offset] = CChar(bitPattern: byte)
        }
        value[bytes.count] = 0

        // A nil destructor tells SQLite the buffer is SQLITE_STATIC. Keep the
        // allocation alive until after finalize in deinit.
        textBindings.append(value)
        let result = exsqlite3_bind_text(statement, index, value, byteCount, nil)
        try check(result, operation: "bind text")
    }

    func bind(_ index: Int32, integer: Int64) throws {
        guard let statement else { throw SiriShoppingDatabaseError.databaseUnavailable }
        try check(exsqlite3_bind_int64(statement, index, integer), operation: "bind integer")
    }

    func bind(_ index: Int32, double: Double) throws {
        guard let statement else { throw SiriShoppingDatabaseError.databaseUnavailable }
        try check(exsqlite3_bind_double(statement, index, double), operation: "bind number")
    }

    func step() throws -> Int32 {
        guard let statement else { throw SiriShoppingDatabaseError.databaseUnavailable }
        let result = exsqlite3_step(statement)
        guard result == 100 || result == 101 else {
            throw SiriShoppingDatabaseError.sqlite(
                operation: "step",
                message: Self.message(for: database),
            )
        }
        return result
    }

    func text(at index: Int32) -> String? {
        guard let statement, let value = exsqlite3_column_text(statement, index) else { return nil }
        return String(cString: value)
    }

    func integer(at index: Int32) -> Int64 {
        guard let statement else { return 0 }
        return exsqlite3_column_int64(statement, index)
    }

    func number(at index: Int32) -> Double {
        guard let statement else { return 0 }
        return exsqlite3_column_double(statement, index)
    }

    private func check(_ result: Int32, operation: String) throws {
        guard result == 0 else {
            throw SiriShoppingDatabaseError.sqlite(
                operation: operation,
                message: Self.message(for: database),
            )
        }
    }

    private static func message(for database: OpaquePointer) -> String {
        guard let error = exsqlite3_errmsg(database) else { return "unbekannter SQLite-Fehler" }
        return String(cString: error)
    }
}

final class SiriShoppingDatabase {
    private static let appGroup = "group.com.goldjunge91.fam1"
    private static let databaseName = "fam-v2.db"
    private static let contextFileName = "fam-siri-context-v1.json"
    private static let keychainService = "app:no-auth"
    private static let keychainKey = "fam.database.sqlcipher-key.v1"

    func add(item rawItem: String) throws {
        let item = rawItem.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !item.isEmpty, item.count <= 500 else {
            throw SiriShoppingDatabaseError.invalidItem
        }

        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup,
        ) else {
            throw SiriShoppingDatabaseError.appGroupUnavailable
        }
        let databaseURL = container.appendingPathComponent(Self.databaseName)
        guard FileManager.default.fileExists(atPath: databaseURL.path) else {
            throw SiriShoppingDatabaseError.databaseUnavailable
        }

        let householdID = try activeHouseholdID(in: container)
        let key = try sharedDatabaseKey()

        var database: OpaquePointer?
        let openResult = databaseURL.path.withCString { path in
            exsqlite3_open_v2(path, &database, 0x00000002 | 0x00010000, nil)
        }
        guard openResult == 0, let database else {
            let message = database.flatMap { exsqlite3_errmsg($0).map(String.init(cString:)) }
                ?? "Datenbank fehlt"
            throw SiriShoppingDatabaseError.sqlite(operation: "open", message: message)
        }
        defer { exsqlite3_close(database) }

        let keyData = try Self.hexData(key)
        let keyResult = keyData.withUnsafeBytes { bytes in
            exsqlite3_key(database, bytes.baseAddress, Int32(keyData.count))
        }
        guard keyResult == 0 else {
            throw SiriShoppingDatabaseError.databaseKeyUnavailable
        }

        try execute("PRAGMA busy_timeout = 5000", on: database)
        try execute("PRAGMA foreign_keys = ON", on: database)
        guard try tableExists("shopping_list_items", in: database),
              try tableExists("outbox", in: database),
              try tableExists("outbox_history", in: database) else {
            throw SiriShoppingDatabaseError.databaseUnavailable
        }

        let now = Date()
        let timestamp = ISO8601DateFormatter().string(from: now)
        let timestampMs = Int64(now.timeIntervalSince1970 * 1000)

        try execute("BEGIN IMMEDIATE", on: database)
        do {
            let merge = try findMergeableItem(item, householdID: householdID, in: database)
            if let merge {
                let mergedQuantity = merge.quantity + 1
                let recipeNames = merge.recipeNames
                try update(
                    database: database,
                    itemID: merge.id,
                    householdID: householdID,
                    quantity: mergedQuantity,
                    recipeNames: recipeNames,
                    timestamp: timestamp,
                )
                let payload: [String: Any] = [
                    "id": merge.id,
                    "household_id": householdID,
                    "quantity": mergedQuantity,
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
                let sortIndex = try nextSortIndex(householdID: householdID, in: database)
                try insert(
                    database: database,
                    itemID: itemID,
                    householdID: householdID,
                    name: item,
                    sortIndex: sortIndex,
                    timestamp: timestamp,
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
                    "store_id": NSNull(),
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
            try execute("COMMIT", on: database)
        } catch {
            try? execute("ROLLBACK", on: database)
            throw error
        }
    }

    private struct MergeableItem {
        let id: String
        let quantity: Double
        let recipeNames: [String]
        let categoryID: String?
        let categorySource: String?
        let categoryClassifierVersion: String?
    }

    private func findMergeableItem(
        _ name: String,
        householdID: String,
        in database: OpaquePointer,
    ) throws -> MergeableItem? {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: """
            select id, quantity, recipe_names, category_id, category_source, category_classifier_version
            from shopping_list_items
            where household_id = ? and deleted_at is null and checked_at is null
              and product_id is null and lower(trim(name)) = lower(trim(?))
              and unit = 'piece' and store_id is null and package_size is null
              and package_size_unit is null
            limit 1
            """,
        )
        try statement.bind(1, text: householdID)
        try statement.bind(2, text: name)
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

    private func update(
        database: OpaquePointer,
        itemID: String,
        householdID: String,
        quantity: Double,
        recipeNames: [String],
        timestamp: String,
    ) throws {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: """
            update shopping_list_items
            set quantity = ?, package_size = null, package_size_unit = null,
                recipe_names = ?, updated_at = ?, _dirty = 1
            where id = ? and household_id = ?
            """,
        )
        try statement.bind(1, double: quantity)
        try statement.bind(2, text: Self.encodeJSON(recipeNames))
        try statement.bind(3, text: timestamp)
        try statement.bind(4, text: itemID)
        try statement.bind(5, text: householdID)
        guard try statement.step() == 101 else { throw SiriShoppingDatabaseError.databaseUnavailable }
    }

    private func insert(
        database: OpaquePointer,
        itemID: String,
        householdID: String,
        name: String,
        sortIndex: Int64,
        timestamp: String,
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
                    ?, null, null, '[]', ?, ?, 1)
            """,
        )
        try statement.bind(1, text: itemID)
        try statement.bind(2, text: householdID)
        try statement.bind(3, text: name)
        try statement.bind(4, integer: sortIndex)
        try statement.bind(5, text: timestamp)
        try statement.bind(6, text: timestamp)
        guard try statement.step() == 101 else { throw SiriShoppingDatabaseError.databaseUnavailable }
    }

    private func nextSortIndex(householdID: String, in database: OpaquePointer) throws -> Int64 {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select coalesce(max(sort_index), -1) + 1 from shopping_list_items where household_id = ? and deleted_at is null",
        )
        try statement.bind(1, text: householdID)
        guard try statement.step() == 100 else { throw SiriShoppingDatabaseError.databaseUnavailable }
        return statement.integer(at: 0)
    }

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
        guard try outboxStatement.step() == 101 else { throw SiriShoppingDatabaseError.databaseUnavailable }

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
        guard try historyStatement.step() == 101 else {
            throw SiriShoppingDatabaseError.databaseUnavailable
        }
    }

    private func activeHouseholdID(in container: URL) throws -> String {
        let contextURL = container.appendingPathComponent(Self.contextFileName)
        guard let data = try? Data(contentsOf: contextURL),
              let object = try? JSONSerialization.jsonObject(with: data),
              let context = object as? [String: Any],
              let householdID = context["activeHouseholdId"] as? String,
              !householdID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SiriShoppingDatabaseError.missingActiveHousehold
        }
        return householdID
    }

    private func sharedDatabaseKey() throws -> String {
        let key = Self.keychainKey.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrGeneric as String: key,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: Self.appGroup,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              Self.isValidHexKey(value) else {
            throw SiriShoppingDatabaseError.databaseKeyUnavailable
        }
        return value
    }

    private func tableExists(_ name: String, in database: OpaquePointer) throws -> Bool {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select 1 from sqlite_master where type = 'table' and name = ? limit 1",
        )
        try statement.bind(1, text: name)
        return try statement.step() == 100
    }

    private func execute(_ sql: String, on database: OpaquePointer) throws {
        let statement = try SiriSQLiteStatement(database: database, sql: sql)
        guard try statement.step() == 101 else {
            throw SiriShoppingDatabaseError.sqlite(operation: "execute", message: "statement failed")
        }
    }

    private static func decodeRecipeNames(_ value: String) -> [String]? {
        guard let data = value.data(using: .utf8),
              let decoded = try? JSONSerialization.jsonObject(with: data),
              let values = decoded as? [Any] else { return nil }
        let names = values.compactMap { $0 as? String }
        return names.count == values.count ? names : nil
    }

    private static func encodeJSON(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let value = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return value
    }

    private static func hexData(_ value: String) throws -> Data {
        guard isValidHexKey(value) else { throw SiriShoppingDatabaseError.databaseKeyUnavailable }
        var data = Data(capacity: value.count / 2)
        var index = value.startIndex
        while index < value.endIndex {
            let next = value.index(index, offsetBy: 2)
            guard let byte = UInt8(value[index..<next], radix: 16) else {
                throw SiriShoppingDatabaseError.databaseKeyUnavailable
            }
            data.append(byte)
            index = next
        }
        return data
    }

    private static func isValidHexKey(_ value: String) -> Bool {
        value.count == 64 && value.allSatisfy { $0.isHexDigit }
    }
}

@available(iOS 17.0, *)
struct AddShoppingListItemIntent: AppIntent {
    static let title: LocalizedStringResource = "Artikel zur Einkaufsliste hinzufügen"
    static let description = IntentDescription("Fügt einen Artikel zur aktiven Einkaufsliste hinzu.")
    static let openAppWhenRun = false

    @Parameter(
        title: "Artikel",
        requestValueDialog: "Was möchtest du zur Einkaufsliste hinzufügen?"
    )
    var item: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try SiriShoppingDatabase().add(item: item)
        let trimmedItem = item.trimmingCharacters(in: .whitespacesAndNewlines)
        return .result(dialog: "\(trimmedItem) wurde zur Einkaufsliste hinzugefügt.")
    }
}
