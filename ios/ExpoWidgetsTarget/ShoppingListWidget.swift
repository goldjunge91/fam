import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct ShoppingListWidget: Widget {
  let name: String = "ShoppingListWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Einkaufsliste")
    .description("Zeigt die offenen Artikel deiner Einkaufsliste.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}