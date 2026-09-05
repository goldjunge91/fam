import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct QuickAddShoppingWidget: Widget {
  let name: String = "QuickAddShoppingWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Schnell hinzufügen")
    .description("Fügt Milch direkt zur Einkaufsliste hinzu.")
    .supportedFamilies([.systemSmall])
  }
}