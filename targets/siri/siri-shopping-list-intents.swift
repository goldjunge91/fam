import AppIntents
import os

// AppIntents declarations stay here; database reads and writes live separately.
@available(iOS 17.0, *)
struct SiriShoppingStore: AppEntity, Identifiable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Einkaufsliste")
    static let defaultQuery = SiriShoppingStoreQuery()

    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

@available(iOS 17.0, *)
struct SiriShoppingStoreQuery: EntityStringQuery {
    // Resolve only stores that are still active in the selected household.
    func entities(for identifiers: [String]) async throws -> [SiriShoppingStore] {
        let stores = try SiriShoppingDatabase().activeStores()
        let requestedIDs = Set(identifiers)
        return stores.filter { requestedIDs.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [SiriShoppingStore] {
        try SiriShoppingDatabase().activeStores(matching: string)
    }

    func suggestedEntities() async throws -> [SiriShoppingStore] {
        try SiriShoppingDatabase().activeStores()
    }
}

@available(iOS 17.0, *)
struct AddShoppingListItemsIntent: AppIntent {
    static let title: LocalizedStringResource = "Artikel zur Einkaufsliste hinzufügen"
    static let description = IntentDescription("Fügt einen oder mehrere Artikel zu einer benannten Einkaufsliste hinzu.")
    static let openAppWhenRun = false

    // https://developer.apple.com/documentation/appintents/appintent/supportedmodes
    @available(iOS 26.0, macOS 26.0, *)
    static var supportedModes: IntentModes { .background }

    // Required parameters let Siri ask for missing values before perform().
    // https://developer.apple.com/documentation/appintents/adding-parameters-to-an-app-intent
    @Parameter(
        title: "Artikel",
        requestValueDialog: "Was möchtest du hinzufügen? Nenne einen oder mehrere Artikel."
    )
    var items: [String]

    @Parameter(
        title: "Einkaufsliste",
        requestValueDialog: "Welche Einkaufsliste?",
        requestDisambiguationDialog: "Welche dieser Einkaufslisten meinst du?",
        query: SiriShoppingStoreQuery(),
    )
    var store: SiriShoppingStore

    static var parameterSummary: some ParameterSummary {
        Summary("Füge \(\.$items) zur Einkaufsliste \(\.$store) hinzu")
    }

    /// Writes only after Siri has collected both required parameters.
    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<Int> {
        let log = OSLog(subsystem: "FamSiri", category: "SiriIntent")
        // Artikel- und Ladenname bleiben aus dem Systemlog heraus.
        os_log("Siri shopping-list intent started", log: log, type: .info)
        let count = try SiriShoppingDatabase().add(items: items, toStoreID: store.id)
        return .result(value: count, dialog: "\(count) Artikel wurden zur Einkaufsliste \(store.name) hinzugefügt.")
    }
}
