import SwiftUI

struct ContentView: View {
    @StateObject private var store: ShoppingWatchStore
    @State private var selectedStoreID: String?

    init(store: ShoppingWatchStore = ShoppingWatchStore()) {
        _store = StateObject(wrappedValue: store)
    }

    var body: some View {
        NavigationStack {
            if !store.hasLoadedSnapshot {
                LoadingShoppingListView()
            } else if store.snapshot.selectableStores.isEmpty {
                EmptyShoppingListView()
            } else if let selectedStore {
                ShoppingListView(
                    shoppingStore: selectedStore,
                    isReachable: store.isReachable,
                    onToggle: { itemID in
                        store.toggle(itemID: itemID, in: selectedStore.id)
                    },
                    onChooseAnotherStore: { selectedStoreID = nil },
                )
            } else {
                StoreSelectionView(
                    stores: store.snapshot.selectableStores,
                    onSelect: { selectedStoreID = $0 },
                )
            }
        }
    }

    private var selectedStore: ShoppingStore? {
        guard let selectedStoreID else { return nil }
        return store.snapshot.selectableStores.first { $0.id == selectedStoreID }
    }
}

private struct LoadingShoppingListView: View {
    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Einkaufsliste wird geladen")
                .font(.headline)
            Text("Bitte öffne die App auf dem iPhone.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .navigationTitle("Einkaufsliste")
    }
}

private struct StoreSelectionView: View {
    let stores: [ShoppingStore]
    let onSelect: (String) -> Void

    var body: some View {
        List {
            Section {
                ForEach(stores) { shoppingStore in
                    Button {
                        onSelect(shoppingStore.id)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(shoppingStore.name)
                                    .font(.headline)
                                Text(summary(for: shoppingStore))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                    .watchGlass()
                    .accessibilityLabel("\(shoppingStore.name), \(summary(for: shoppingStore))")
                }
            } header: {
                Text("Markt auswählen")
            }
        }
        .navigationTitle("Einkaufen")
    }

    private func summary(for shoppingStore: ShoppingStore) -> String {
        let openCount = shoppingStore.openCount
        return openCount == 1 ? "1 Artikel offen" : "\(openCount) Artikel offen"
    }
}

private struct ShoppingListView: View {
    let shoppingStore: ShoppingStore
    let isReachable: Bool
    let onToggle: (String) -> Void
    let onChooseAnotherStore: () -> Void

    var body: some View {
        List {
            Section {
                Button("Märkte", action: onChooseAnotherStore)
                    .accessibilityLabel("Anderen Markt auswählen")

                ShoppingProgressView(
                    snapshot: snapshot,
                    isReachable: isReachable,
                )
            }

            ForEach(snapshot.categoryGroups) { group in
                Section(group.title) {
                    ForEach(group.items) { item in
                        ShoppingItemRow(item: item) {
                            onToggle(item.id)
                        }
                    }
                }
            }
        }
        .navigationTitle(shoppingStore.name)
    }

    private var snapshot: ShoppingSnapshot {
        ShoppingSnapshot(
            storeName: shoppingStore.name,
            updatedAt: .now,
            items: shoppingStore.items,
        )
    }
}

private extension View {
    func watchGlass() -> some View {
        if #available(watchOS 26.0, *) {
            return AnyView(glassEffect(.regular, in: .capsule))
        } else {
            return AnyView(background(.ultraThinMaterial, in: Capsule()))
        }
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
