import AppIntents

/// Dieser Provider stellt die Aktionen der Siri-Extension in Kurzbefehle und
/// Siri bereit. Jeder AppShortcut verbindet einen AppIntent mit Sprachphrasen.
/// `shortTitle` ist der sichtbare Titel in Kurzbefehle, keine Siri-Phrase.
/// https://developer.apple.com/videos/play/wwdc2023/10103/
@available(iOS 17.0, *)
struct FamMainAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    // Eine Aktion deckt das Hinzufügen eines oder mehrerer Artikel ab.
    AppShortcut(
      intent: AddShoppingListItemsIntent(),
      // Jede Phrase nennt die App; app.json ergänzt Aussprache und Synonyme.
      phrases: [
        "Füge einen Artikel mit \(.applicationName) hinzu",
        "Setze mit \(.applicationName) einen Artikel auf die Einkaufsliste",
        "Ergänze die Einkaufsliste mit \(.applicationName)",
        "Füge einen Artikel zur Einkaufsliste in \(.applicationName) hinzu",
        "Füge mehrere Artikel mit \(.applicationName) hinzu",
        "Setze mehrere Artikel mit \(.applicationName) auf die Einkaufsliste",
        "Packe mehrere Artikel mit \(.applicationName) auf die Einkaufsliste",
        "Füge mit \(.applicationName) mehrere Artikel zur Einkaufsliste hinzu",
        "Füge Artikel zur Einkaufsliste bei \(\.$store) mit \(.applicationName) hinzu",
        "Schreibe mit \(.applicationName) etwas auf meine Einkaufsliste",
        "Trage mit \(.applicationName) etwas auf die Einkaufsliste ein",
        "Ergänze meine Einkaufsliste mit \(.applicationName)",
        "Setze mit \(.applicationName) etwas auf meine Einkaufsliste",
        "Nimm mit \(.applicationName) einen Artikel in die Einkaufsliste auf",
        "Packe mit \(.applicationName) etwas auf meine Einkaufsliste",
        "Füge meiner Einkaufsliste mit \(.applicationName) noch etwas hinzu",
        "Ich möchte mit \(.applicationName) etwas zur Einkaufsliste hinzufügen",
      ],
      // Dieser Titel wird in Kurzbefehle als Aktionsname angezeigt.
      shortTitle: "Einkaufsartikel hinzufügen",
      systemImageName: "cart.badge.plus"
    )
  }
}
