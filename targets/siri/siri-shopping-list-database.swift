import AppIntents
#if canImport(ExpoSQLite)
internal import ExpoSQLite
#else
import SQLite3
#endif
import Foundation
import os
import Security

// Expo uses SQLCipher wrappers; standalone tests use the system SQLite module.
#if !canImport(ExpoSQLite)
func exsqlite3_prepare_v2(
    _ database: OpaquePointer,
    _ sql: UnsafePointer<CChar>,
    _ byteCount: Int32,
    _ statement: UnsafeMutablePointer<OpaquePointer?>,
    _ tail: UnsafeMutablePointer<UnsafePointer<CChar>?>?,
) -> Int32 {
    sqlite3_prepare_v2(database, sql, byteCount, statement, tail)
}

func exsqlite3_finalize(_ statement: OpaquePointer?) -> Int32 {
    sqlite3_finalize(statement)
}

func exsqlite3_bind_null(_ statement: OpaquePointer, _ index: Int32) -> Int32 {
    sqlite3_bind_null(statement, index)
}

func exsqlite3_bind_text(
    _ statement: OpaquePointer,
    _ index: Int32,
    _ value: UnsafeMutablePointer<CChar>,
    _ byteCount: Int32,
    _ destructor: (@convention(c) (UnsafeMutableRawPointer?) -> Void)?,
) -> Int32 {
    sqlite3_bind_text(
        statement,
        index,
        UnsafeRawPointer(value).assumingMemoryBound(to: UInt8.self),
        byteCount,
        destructor,
    )
}

func exsqlite3_bind_int64(_ statement: OpaquePointer, _ index: Int32, _ value: Int64) -> Int32 {
    sqlite3_bind_int64(statement, index, value)
}

func exsqlite3_bind_double(_ statement: OpaquePointer, _ index: Int32, _ value: Double) -> Int32 {
    sqlite3_bind_double(statement, index, value)
}

func exsqlite3_step(_ statement: OpaquePointer) -> Int32 {
    sqlite3_step(statement)
}

func exsqlite3_column_text(_ statement: OpaquePointer, _ index: Int32) -> UnsafePointer<CChar>? {
    sqlite3_column_text(statement, index).map {
        UnsafeRawPointer($0).assumingMemoryBound(to: CChar.self)
    }
}

func exsqlite3_column_int64(_ statement: OpaquePointer, _ index: Int32) -> Int64 {
    sqlite3_column_int64(statement, index)
}

func exsqlite3_column_double(_ statement: OpaquePointer, _ index: Int32) -> Double {
    sqlite3_column_double(statement, index)
}

func exsqlite3_errmsg(_ database: OpaquePointer) -> UnsafePointer<CChar>? {
    sqlite3_errmsg(database)
}

func exsqlite3_open_v2(
    _ path: UnsafePointer<CChar>,
    _ database: UnsafeMutablePointer<OpaquePointer?>,
    _ flags: Int32,
    _ vfs: UnsafePointer<CChar>?,
) -> Int32 {
    sqlite3_open_v2(path, database, flags, vfs)
}

func exsqlite3_close(_ database: OpaquePointer) -> Int32 {
    sqlite3_close(database)
}

func exsqlite3_changes(_ database: OpaquePointer) -> Int32 {
    sqlite3_changes(database)
}

func exsqlite3_last_insert_rowid(_ database: OpaquePointer) -> Int64 {
    sqlite3_last_insert_rowid(database)
}
#endif

private struct SiriShoppingDatabaseFiles {
    let databaseName: String
    let contextFileName: String
    let keyFileName: String
}

enum SiriShoppingDatabaseError: Error, CustomLocalizedStringResourceConvertible {
    case appGroupUnavailable
    case databaseUnavailable
    case databaseKeyUnavailable
    case keychain(status: OSStatus)
    case missingActiveHousehold
    case invalidItem
    case invalidItemList
    case storeNotFound
    case ambiguousStore
    case sqlite(operation: String, message: String)

    var diagnosticCode: String {
        switch self {
        case .appGroupUnavailable: "app-group-unavailable"
        case .databaseUnavailable: "database-unavailable"
        case .databaseKeyUnavailable: "database-key-unavailable"
        case let .keychain(status): "keychain-status-\(status)"
        case .missingActiveHousehold: "active-household-missing"
        case .storeNotFound: "store-not-found"
        case .ambiguousStore: "ambiguous-store"
        case .invalidItemList: "invalid-item-list"
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
        case .storeNotFound:
            "Diese Einkaufsliste wurde im aktiven Haushalt nicht gefunden. Prüfe den Namen in fam."
        case .ambiguousStore:
            "Mehrere Einkaufslisten haben diesen Namen. Benenne sie in fam eindeutig und versuche es erneut."
        case .invalidItemList:
            "Bitte nenne einen oder mehrere Artikel. Trenne mehrere Artikel mit Komma, Semikolon oder und, zum Beispiel Milch, Brot und Käse."
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

    /// Prepares one statement and owns its bindings until SQLite finalizes it.
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
            _ = exsqlite3_finalize(statement)
        }
        textBindings.forEach { $0.deallocate() }
    }

    func bind(_ index: Int32, text: String?) throws {
        guard let statement else { throw SiriShoppingDatabaseError.databaseUnavailable }
        guard let text else {
            try check(exsqlite3_bind_null(statement, index), operation: "bind null")
            return
        }
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

    /// Returns SQLITE_ROW or SQLITE_DONE; all other SQLite results become errors.
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
    static let logger = Logger(
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

    /// Parses Siri's response, writes the batch, and returns the number of spoken items.
    func add(items rawItems: String, toStoreID storeID: String) throws -> Int {
        let items = try Self.parseItems(rawItems)
        do {
            try addToDatabase(items: items, storeID: storeID)
            Self.logger.info("Siri shopping-list batch completed")
            return items.count
        } catch {
            let code = (error as? SiriShoppingDatabaseError)?.diagnosticCode ?? "unexpected"
            Self.logger.error("Siri shopping-list batch failed: \(code, privacy: .public)")
            throw error
        }
    }

    // Siri suggestions must never expose deleted stores or another household's lists.
    func activeStores(matching searchText: String? = nil) throws -> [SiriShoppingStore] {
        try withSharedDatabase(readOnly: true) { database, householdID in
            try stores(matching: searchText, householdID: householdID, in: database)
        }
    }

    /// Loads active stores for one household and optionally filters Siri's suggestions.
    func stores(
        matching searchText: String?, householdID: String, in database: OpaquePointer,
    ) throws -> [SiriShoppingStore] {
        let statement = try SiriSQLiteStatement(
            database: database,
            sql: "select id, name from stores where household_id = ? and deleted_at is null order by name collate nocase, id",
        )
        try statement.bind(1, text: householdID)
        let query = searchText?.trimmingCharacters(in: .whitespacesAndNewlines)
        var stores: [SiriShoppingStore] = []
        while try statement.step() == 100 {
            guard let id = statement.text(at: 0), let name = statement.text(at: 1) else { continue }
            if let query, !query.isEmpty, !name.localizedStandardContains(query) { continue }
            stores.append(SiriShoppingStore(id: id, name: name))
        }
        return stores
    }

    /// Maps parser failures to the localized error exposed by the App Intent.
    static func parseItems(_ rawItems: String) throws -> [String] {
        do {
            return try SiriShoppingItemParser.parse(rawItems)
        } catch SiriShoppingItemParserError.invalidItemList {
            throw SiriShoppingDatabaseError.invalidItemList
        }
    }

    /// Validates the batch and confirms the local sync tables exist before writing.
    private func addToDatabase(items rawItems: [String], storeID: String?) throws {
        let items = rawItems.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard !items.isEmpty, items.allSatisfy({ !$0.isEmpty && $0.count <= 500 }) else {
            throw SiriShoppingDatabaseError.invalidItem
        }

        try withSharedDatabase { database, householdID in
            guard try tableExists("shopping_list_items", in: database),
                  try tableExists("outbox", in: database),
                  try tableExists("outbox_history", in: database) else {
                throw SiriShoppingDatabaseError.databaseUnavailable
            }
            try write(items: items, storeID: storeID, householdID: householdID, in: database)
        }
    }

    /// Opens the shared encrypted database, applies connection settings, then closes it.
    private func withSharedDatabase<T>(
        readOnly: Bool = false,
        _ operation: (OpaquePointer, String) throws -> T,
    ) throws -> T {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup,
        ) else {
            throw SiriShoppingDatabaseError.appGroupUnavailable
        }
        let files = SiriShoppingDatabaseFiles(
            databaseName: Self.databaseName,
            contextFileName: Self.contextFileName,
            keyFileName: Self.databaseKeyFile,
        )
        let databaseURL = container.appendingPathComponent(files.databaseName)
        guard FileManager.default.fileExists(atPath: databaseURL.path) else {
            throw SiriShoppingDatabaseError.databaseUnavailable
        }

        let householdID = try activeHouseholdID(in: container, fileName: files.contextFileName)
        let key = try sharedDatabaseKey(in: container, fileName: files.keyFileName)

        var database: OpaquePointer?
        let openFlags: Int32 = (readOnly ? 0x00000001 : 0x00000002) | 0x00010000
        let openResult = databaseURL.path.withCString { path in
            exsqlite3_open_v2(path, &database, openFlags, nil)
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
        if !readOnly {
            try execute("PRAGMA foreign_keys = ON", on: database)
        }
        return try operation(database, householdID)
    }

    /// Reads the household context last written by the main app.
    private func activeHouseholdID(in container: URL, fileName: String) throws -> String {
        let contextURL = container.appendingPathComponent(fileName)
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
    private func sharedDatabaseKey(in container: URL, fileName: String) throws -> String {
        let keyFileURL = container.appendingPathComponent(fileName)
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

    func execute(_ sql: String, on database: OpaquePointer) throws {
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

    /// Rejects malformed JSON and mixed-type arrays instead of silently dropping values.
    static func decodeRecipeNames(_ value: String) -> [String]? {
        guard let data = value.data(using: .utf8),
              let decoded = try? JSONSerialization.jsonObject(with: data),
              let values = decoded as? [Any] else { return nil }
        let names = values.compactMap { $0 as? String }
        return names.count == values.count ? names : nil
    }

    /// Uses stable key ordering for JSON persisted in the local database and outbox.
    static func encodeJSON(_ object: Any) -> String {
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
