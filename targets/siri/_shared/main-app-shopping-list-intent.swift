import AppIntents

// Der AppShortcutsProvider ist die einzige Quelle der Siri-Phrasen fuer den
// Einkaufslisten-Intent. Er referenziert ausschliesslich
// `AddShoppingListItemIntent` aus `siri-shopping-list-intents.swift`; der
// Vor-Split-Klon im Haupt-App-Target ist entfernt.
@available(iOS 17.0, *)
struct FamMainAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddShoppingListItemIntent(),
      phrases: [
        "Füge über die App \(.applicationName) einen Artikel zur Einkaufsliste hinzu",
        "Nutze die App \(.applicationName) für einen Artikel auf der Einkaufsliste",
        "Füge einen Artikel zur Einkaufsliste in \(.applicationName) hinzu",
        "Setze einen Artikel auf die Einkaufsliste in \(.applicationName)",
      ],
      shortTitle: "Einkaufsliste",
      systemImageName: "cart.badge.plus"
    )
  }
}
