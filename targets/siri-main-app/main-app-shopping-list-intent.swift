import AppIntents

@available(iOS 17.0, *)
struct MainAppAddShoppingListItemIntent: AppIntent {
    static let title: LocalizedStringResource = "Artikel zur Einkaufsliste hinzufügen (App)"
    static let description = IntentDescription(
        "Fügt einen Artikel über das Haupt-App-Target direkt zur aktiven Einkaufsliste hinzu.",
    )
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

@available(iOS 17.0, *)
struct FamMainAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: MainAppAddShoppingListItemIntent(),
            phrases: [
                "Füge über die App \(.applicationName) einen Artikel zur Einkaufsliste hinzu",
                "Nutze die App \(.applicationName) für einen Artikel auf der Einkaufsliste"
            ],
            shortTitle: "Einkaufsliste App",
            systemImageName: "cart.badge.plus"
        )
        AppShortcut(
            intent: AddShoppingListItemIntent(),
            phrases: [
                "Füge einen Artikel zur Einkaufsliste in \(.applicationName) hinzu",
                "Setze einen Artikel auf die Einkaufsliste in \(.applicationName)"
            ],
            shortTitle: "Einkaufsliste",
            systemImageName: "cart.badge.plus"
        )
    }
}
