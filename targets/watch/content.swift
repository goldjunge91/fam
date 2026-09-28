import SwiftUI

struct ContentView: View {
    @StateObject private var store: ShoppingWatchStore

    init(store: ShoppingWatchStore = ShoppingWatchStore()) {
        _store = StateObject(wrappedValue: store)
    }

    var body: some View {
        NavigationStack {
            if store.snapshot.items.isEmpty {
                EmptyShoppingListView()
            } else {
                shoppingList
            }
        }
    }

    private var shoppingList: some View {
        List {
            Section {
                ShoppingProgressView(
                    snapshot: store.snapshot,
                    isReachable: store.isReachable,
                )
            }

            ForEach(store.snapshot.categoryGroups) { group in
                Section(group.title) {
                    ForEach(group.items) { item in
                        ShoppingItemRow(item: item) {
                            store.toggle(itemID: item.id)
                        }
                    }
                }
            }
        }
        .navigationTitle(store.snapshot.storeName ?? "Einkaufsliste")
    }
}

private struct ShoppingProgressView: View {
    let snapshot: ShoppingSnapshot
    let isReachable: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("\(snapshot.openCount) offen")
                    .font(.headline)
                Spacer()
                Text("\(snapshot.checkedCount)/\(snapshot.items.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: snapshot.progress)
                .tint(.accentColor)

            HStack(spacing: 4) {
                SyncStatusView(isReachable: isReachable)
                Text(isReachable ? "iPhone verbunden" : "Letzter lokaler Stand")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ShoppingItemRow: View {
    let item: ShoppingItem
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 8) {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.isChecked ? .green : .secondary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.body)
                        .foregroundStyle(item.isChecked ? .secondary : .primary)
                        .strikethrough(item.isChecked)
                        .lineLimit(2)

                    if !item.quantityLabel.isEmpty {
                        Text(item.quantityLabel)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.accessibilityLabel)
        .accessibilityValue(item.isChecked ? "Erledigt" : "Offen")
    }
}

private struct SyncStatusView: View {
    let isReachable: Bool

    var body: some View {
        Image(systemName: isReachable ? "iphone.and.arrow.forward" : "iphone.slash")
            .foregroundStyle(isReachable ? .green : .secondary)
            .accessibilityLabel(isReachable ? "iPhone verbunden" : "Letzter lokaler Stand")
    }
}

private struct EmptyShoppingListView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "cart")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("Keine Einkaufsliste")
                .font(.headline)
            Text("Die Liste wird vom iPhone synchronisiert.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .navigationTitle("Einkaufsliste")
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView(
            store: ShoppingWatchStore(
                snapshot: .preview,
                activatesSession: false,
            ),
        )
    }
}
