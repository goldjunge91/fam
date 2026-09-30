import AppIntents
internal import ExpoSQLite
import Foundation
import os
import Security

enum SiriShoppingDatabaseError: Error, CustomLocalizedStringResourceConvertible {
    case appGroupUnavailable
    case databaseUnavailable
    case databaseKeyUnavailable
    case keychain(status: OSStatus)
    case missingActiveHousehold
    case invalidItem
    case sqlite(operation: String, message: String)

    var diagnosticCode: String {
        switch self {
        case .appGroupUnavailable: "app-group-unavailable"
        case .databaseUnavailable: "database-unavailable"
        case .databaseKeyUnavailable: "database-key-unavailable"
        case let .keychain(status): "keychain-status-\(status)"
        case .missingActiveHousehold: "active-household-missing"
        case .invalidItem: "invalid-item"
        case let .sqlite(operation, _): "sqlite-\(operation)"
        }
    }

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .appGroupUnavailable:
            "fam kann den gemeinsamen Speicher nicht öffnen. Installiere die aktuelle fam-App und öffne sie einmal."
        case .databaseUnavailable:
            "Die lokale Einkaufsliste ist noch nicht bereit. Öffne fam einmal und versuche es erneut."
        case .databaseKeyUnavailable:
            "Der Schlüssel für die lokale Einkaufsliste ist nicht verfügbar. Öffne fam einmal und versuche es erneut."
        case .keychain:
            "Der sichere Zugriff auf die Einkaufsliste ist fehlgeschlagen. Öffne fam einmal und versuche es erneut."
        case .missingActiveHousehold:
            "Melde dich in fam an und wähle einen aktiven Haushalt aus."
        case .invalidItem:
            "Bitte nenne einen gültigen Artikel."
        case let .sqlite(operation, _):
            "Die Einkaufsliste konnte nicht gespeichert werden (SQLite \(operation)). Öffne fam einmal und versuche es erneut."
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
    private static let logger = Logger(
        subsystem: "com.goldjunge91.fam1",
        category: "SiriShoppingDatabase",
    )
    private static let appGroup = "group.com.goldjunge91.fam1"
    /// Keychain-Gruppe des SQLCipher-Schluessels. Bewusst NICHT die App Group:
    /// das Provisioning-Profil deckt `SW8RP7PA3W.*` ab, nicht `group.*`, und
    /// Apple entfernt beim Signieren jedes nicht gedeckte Entitlement. Ohne
    /// Team-ID-Prefix blieb die `.xcent` leer und der Schluessel unlesbar.
    private static let keychainAccessGroup = "SW8RP7PA3W.com.goldjunge91.fam1"
    private static let databaseName = "fam-v2.db"
    private static let contextFileName = "fam-siri-context-v1.json"
    private static let keychainService = "app:no-auth"
    private static let keychainKey = "fam.database.sqlcipher-key.v1"
    private static let databaseKeyFile = "fam.database.sqlcipher-key.v1"

    func add(item rawItem: String) throws {
        do {
            try addToDatabase(item: rawItem)
            Self.logger.info("Siri shopping-list write completed")
        } catch {
            let code = (error as? SiriShoppingDatabaseError)?.diagnosticCode ?? "unexpected"
            Self.logger.error("Siri shopping-list write failed: \(code, privacy: .public)")
            throw error
        }
    }

    private func addToDatabase(item rawItem: String) throws {
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
        let key = try sharedDatabaseKey(in: container)

        var database: OpaquePointer?
        let openResult = databaseURL.path.withCString { path in
            exsqlite3_open_v2(path, &database, 0x00000002 | 0x00010000, nil)
        }
        guard openResult == 0, let database else {
            let message = database.flatMap { exsqlite3_errmsg($0).map(String.init(cString:)) }
                ?? "Datenbank fehlt"
            throw SiriShoppingDatabaseError.sqlite(operation: "open", message: message)
        }
        // `sqlite3_close` rollt eine offene Transaktion nur implizit zurueck
        // und meldet selbst dann nichts zurueck. Den Rueckgabewert zu pruefen
        // macht einen gescheiterten Close sichtbar, statt ihn zu verschlucken.
        defer {
            let closeResult = exsqlite3_close(database)
            if closeResult != 0 {
                Self.logger.error("Siri database close failed: \(closeResult, privacy: .public)")
            }
        }

        // Die Haupt-App setzt den Schlüssel als `PRAGMA key = "x'<hex>'"`.
        // Das `x'...'` erzwingt Raw-Key-Semantik: die 32 Bytes sind der
        // Schlüssel selbst. `exsqlite3_key` erwartet dagegen Klartext und
        // leitet daraus per PBKDF2 ab — dieselben Bytes ergaeben einen
        // anderen Schluessel und die Datei bliebe unlesbar (SQLITE_NOTADB
        // bei der ersten prepare_v2, also "SQLite prepare"). Deshalb wird der
        // Schluessel als PRAGMA gesetzt, genau wie im JS-Owner.
        do {
            try execute(Self.keyPragma(for: key), on: database)
        } catch {
            Self.logger.error("Siri database key pragma failed")
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
                    updatedAtMs: timestampMs,
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

    /// `updated_at` ist im Drizzle-Schema `integer not null` in Epoch-
    /// Millisekunden (`mirrorColumns().updatedAt`) und wird so auch vom
    /// JS-Owner geschrieben. Der Outbox-Payload traegt dagegen die
    /// ISO-Zeichenkette, weil Supabase `timestamptz` erwartet — die beiden
    /// Formate gehoeren bewusst an verschiedene Ziele.
    private func update(
        database: OpaquePointer,
        itemID: String,
        householdID: String,
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
            where id = ? and household_id = ?
            """,
        )
        try statement.bind(1, double: quantity)
        try statement.bind(2, text: Self.encodeJSON(recipeNames))
        try statement.bind(3, integer: updatedAtMs)
        try statement.bind(4, text: itemID)
        try statement.bind(5, text: householdID)
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
                    ?, null, null, '[]', ?, ?, 1)
            """,
        )
        try statement.bind(1, text: itemID)
        try statement.bind(2, text: householdID)
        try statement.bind(3, text: name)
        try statement.bind(4, integer: sortIndex)
        try statement.bind(5, text: createdAt)
        try statement.bind(6, integer: updatedAtMs)
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

    /// Der Schluessel kommt zuerst aus dem gemeinsamen App-Group-Container.
    ///
    /// Die Keychain ist nicht nutzbar: Apple entfernt beim Signieren jedes
    /// `keychain-access-groups`-Entitlement, das das Provisioning-Profil
    /// nicht abdeckt, und das Projekt-Profil erlaubt nur `SW8RP7PA3W.*`. Die
    /// App Group selbst ist freigeschaltet — deshalb der Weg ueber die Datei.
    /// Die Keychain bleibt als Rueckfall fuer aeltere Installationen.
    private func sharedDatabaseKey(in container: URL) throws -> String {
        let keyFileURL = container.appendingPathComponent(Self.databaseKeyFile)
        if let data = try? Data(contentsOf: keyFileURL),
           let value = String(data: data, encoding: .utf8)?
           .trimmingCharacters(in: .whitespacesAndNewlines),
           Self.isValidHexKey(value) {
            return value
        }
        return try keychainDatabaseKey()
    }

    private func keychainDatabaseKey() throws -> String {
        let key = Self.keychainKey.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrGeneric as String: key,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: Self.keychainAccessGroup,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                throw SiriShoppingDatabaseError.databaseKeyUnavailable
            }
            throw SiriShoppingDatabaseError.keychain(status: status)
        }
        guard let data = result as? Data,
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
        // Manche PRAGMAs liefern eine Zeile zurueck (`PRAGMA busy_timeout` gibt
        // den gesetzten Wert). Ein einzelner `step()` reicht dort nicht, sonst
        // wirft `execute` bei einem gueltigen Statement. Bis SQLITE_DONE
        // durchsteppen — Transaktionssteuerung liefert weiterhin DONE, bleibt
        // also unveraendert. Echte Fehler wirft weiterhin `step()`.
        //
        // Die Fehlerbezeichnung bleibt `execute`, obwohl `step()` wirft: sie
        // benennt die fehlgeschlagene Anweisung, waehrend `step()` an vier
        // anderen Stellen (insert, update, nextSortIndex, enqueue) dieselbe
        // Fehlermeldung erzeugen wuerde. Ohne sie ist ein SQLITE_BUSY auf
        // `BEGIN IMMEDIATE` — der wahrscheinlichste Produktionsfehler, gegen
        // den das busy_timeout existiert — nicht mehr von einem Fehler im
        // eigentlichen Schreibvorgang zu unterscheiden.
        do {
            while try statement.step() == 100 {}
        } catch {
            throw SiriShoppingDatabaseError.sqlite(
                operation: "execute",
                message: (error as? SiriShoppingDatabaseError)
                    .flatMap { ($0.diagnosticCode) } ?? "statement failed",
            )
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

    private static func isValidHexKey(_ value: String) -> Bool {
        value.count == 64 && value.allSatisfy { $0.isHexDigit }
    }

    /// Spiegelt `toSqlCipherKeyPragma` aus `local-database-encryption.ts`.
    private static func keyPragma(for key: String) -> String {
        "PRAGMA key = \"x'\(key)'\""
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
