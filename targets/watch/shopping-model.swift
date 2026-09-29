import Foundation
import SwiftUI
import WatchConnectivity

private func decodeWatchSnapshotDate(from decoder: Decoder) throws -> Date {
    let container = try decoder.singleValueContainer()

    if let referenceInterval = try? container.decode(Double.self) {
        return Date(timeIntervalSinceReferenceDate: referenceInterval)
    }

    let value = try container.decode(String.self)
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) {
        return date
    }

    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: value) {
        return date
    }

    throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Expected an ISO-8601 date or a numeric reference interval.",
    )
}

struct ShoppingItem: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let quantityLabel: String
    let category: String
    var isChecked: Bool

    var accessibilityLabel: String {
        quantityLabel.isEmpty ? name : "\(name), \(quantityLabel)"
    }
}

struct ShoppingStore: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    var items: [ShoppingItem]

    var openCount: Int {
        items.reduce(into: 0) { count, item in
            if !item.isChecked { count += 1 }
        }
    }
}

struct ShoppingCategoryGroup: Identifiable {
    let title: String
    let items: [ShoppingItem]

    var id: String { title }
}

struct ShoppingSnapshot: Codable, Equatable {
    var householdID: String?
    var storeName: String?
    var updatedAt: Date
    var items: [ShoppingItem]
    var stores: [ShoppingStore]

    private enum CodingKeys: String, CodingKey {
        case householdID = "householdId"
        case storeName
        case updatedAt
        case items
        case stores
    }

    init(
        householdID: String? = nil,
        storeName: String?,
        updatedAt: Date,
        items: [ShoppingItem],
        stores: [ShoppingStore] = [],
    ) {
        self.householdID = householdID
        self.storeName = storeName
        self.updatedAt = updatedAt
        self.items = items
        self.stores = stores
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        householdID = try container.decodeIfPresent(String.self, forKey: .householdID)
        storeName = try container.decodeIfPresent(String.self, forKey: .storeName)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        items = try container.decode([ShoppingItem].self, forKey: .items)
        stores = try container.decodeIfPresent([ShoppingStore].self, forKey: .stores) ?? []
    }

    var openCount: Int {
        items.reduce(into: 0) { count, item in
            if !item.isChecked { count += 1 }
        }
    }

    var checkedCount: Int { items.count - openCount }

    var progress: Double {
        guard !items.isEmpty else { return 0 }
        return Double(checkedCount) / Double(items.count)
    }

    var categoryGroups: [ShoppingCategoryGroup] {
        var grouped: [String: [ShoppingItem]] = [:]
        var categoryOrder: [String] = []

        for item in items {
            let title = item.category.isEmpty ? "Sonstiges" : item.category
            if grouped[title] == nil {
                categoryOrder.append(title)
                grouped[title] = []
            }
            grouped[title, default: []].append(item)
        }

        return categoryOrder.compactMap { title in
            guard let items = grouped[title] else { return nil }
            return ShoppingCategoryGroup(title: title, items: items)
        }
    }

    var selectableStores: [ShoppingStore] {
        if !stores.isEmpty { return stores }
        if let storeName, !storeName.isEmpty {
            return [ShoppingStore(id: "legacy", name: storeName, items: items)]
        }
        guard !items.isEmpty else { return [] }
        return [ShoppingStore(id: "legacy", name: "Einkaufsliste", items: items)]
    }

    static let empty = ShoppingSnapshot(
        storeName: nil,
        updatedAt: .now,
        items: [],
    )

    static let preview = ShoppingSnapshot(
        storeName: "Wochenmarkt",
        updatedAt: .now,
        items: [
            ShoppingItem(
                id: "milk",
                name: "Milch",
                quantityLabel: "2 × 1 l",
                category: "Kühlung",
                isChecked: false,
            ),
            ShoppingItem(
                id: "apples",
                name: "Äpfel",
                quantityLabel: "1 kg",
                category: "Obst & Gemüse",
                isChecked: false,
            ),
            ShoppingItem(
                id: "bread",
                name: "Vollkornbrot",
                quantityLabel: "1 Stück",
                category: "Backwaren",
                isChecked: true,
            ),
        ],
        stores: [
            ShoppingStore(
                id: "weekly-market",
                name: "Wochenmarkt",
                items: [
                    ShoppingItem(
                        id: "milk",
                        name: "Milch",
                        quantityLabel: "2 × 1 l",
                        category: "Kühlung",
                        isChecked: false,
                    ),
                    ShoppingItem(
                        id: "apples",
                        name: "Äpfel",
                        quantityLabel: "1 kg",
                        category: "Obst & Gemüse",
                        isChecked: false,
                    ),
                ],
            ),
        ],
    )
}

final class ShoppingWatchStore: NSObject, ObservableObject, WCSessionDelegate {
    private static let appGroup = "group.com.goldjunge91.fam1"

    @Published private(set) var snapshot: ShoppingSnapshot
    @Published private(set) var isReachable = false
    @Published private(set) var hasLoadedSnapshot: Bool

    private let defaults: UserDefaults
    private let snapshotKey = "fam.shopping.snapshot"
    private let encoder = JSONEncoder()
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom(decodeWatchSnapshotDate)
        return decoder
    }()
    private var session: WCSession?

    init(
        snapshot: ShoppingSnapshot? = nil,
        activatesSession: Bool = true,
    ) {
        let sharedDefaults = UserDefaults(suiteName: Self.appGroup) ?? .standard
        let initialSnapshot = snapshot ?? Self.loadSnapshot(from: sharedDefaults)
        defaults = sharedDefaults
        self.snapshot = initialSnapshot ?? .empty
        hasLoadedSnapshot = initialSnapshot != nil
        super.init()

        if activatesSession {
            configureConnectivity()
        }
    }

    func toggle(itemID: String) {
        guard let index = snapshot.items.firstIndex(where: { $0.id == itemID }) else { return }

        snapshot.items[index].isChecked.toggle()
        let isChecked = snapshot.items[index].isChecked
        for storeIndex in snapshot.stores.indices {
            guard let storeItemIndex = snapshot.stores[storeIndex].items.firstIndex(where: { $0.id == itemID }) else {
                continue
            }
            snapshot.stores[storeIndex].items[storeItemIndex].isChecked = isChecked
        }
        snapshot.updatedAt = .now
        persistSnapshot()
        sendToggle(item: snapshot.items[index])
    }

    func toggle(itemID: String, in storeID: String) {
        guard let storeIndex = snapshot.stores.firstIndex(where: { $0.id == storeID }),
              let itemIndex = snapshot.stores[storeIndex].items.firstIndex(where: { $0.id == itemID })
        else {
            toggle(itemID: itemID)
            return
        }

        snapshot.stores[storeIndex].items[itemIndex].isChecked.toggle()
        let isChecked = snapshot.stores[storeIndex].items[itemIndex].isChecked
        if let snapshotItemIndex = snapshot.items.firstIndex(where: { $0.id == itemID }) {
            snapshot.items[snapshotItemIndex].isChecked = isChecked
        }
        snapshot.updatedAt = .now
        persistSnapshot()
        sendToggle(item: snapshot.stores[storeIndex].items[itemIndex])
    }

    private func configureConnectivity() {
        guard WCSession.isSupported() else { return }

        let session = WCSession.default
        session.delegate = self
        self.session = session
        session.activate()
    }

    private func sendToggle(item: ShoppingItem) {
        guard let session,
              let householdID = snapshot.householdID,
              !householdID.isEmpty
        else {
            return
        }

        let payload: [String: Any] = [
            "type": "shopping_item.toggle",
            "household_id": householdID,
            "item_id": item.id,
            "checked": item.isChecked,
        ]

        guard session.activationState == .activated else { return }

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                print("WatchConnectivity toggle failed: \(error.localizedDescription)")
            }
        } else {
            session.transferUserInfo(payload)
        }
    }

    private func receiveSnapshot(from payload: [String: Any]) {
        let data: Data?
        if let snapshotData = payload["snapshot"] as? Data {
            data = snapshotData
        } else if let snapshotString = payload["snapshot"] as? String {
            data = snapshotString.data(using: .utf8)
        } else {
            data = nil
        }

        guard let data else { return }

        do {
            let snapshot = try decoder.decode(ShoppingSnapshot.self, from: data)
            DispatchQueue.main.async {
                self.snapshot = snapshot
                self.hasLoadedSnapshot = true
                self.persistSnapshot()
            }
        } catch {
            print("WatchConnectivity snapshot decode failed: \(error.localizedDescription)")
        }
    }

    private func persistSnapshot() {
        guard let data = try? encoder.encode(snapshot),
              let json = String(data: data, encoding: .utf8)
        else { return }
        defaults.set(json, forKey: snapshotKey)
    }

    private static func loadSnapshot(from defaults: UserDefaults) -> ShoppingSnapshot? {
        guard let json = defaults.string(forKey: "fam.shopping.snapshot"),
              let data = json.data(using: .utf8)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom(decodeWatchSnapshotDate)
        return try? decoder.decode(ShoppingSnapshot.self, from: data)
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?,
    ) {
        DispatchQueue.main.async {
            self.isReachable = activationState == .activated && session.isReachable
            self.receiveSnapshot(from: session.receivedApplicationContext)
        }

        if let error {
            print("WatchConnectivity activation failed: \(error.localizedDescription)")
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any],
    ) {
        receiveSnapshot(from: applicationContext)
    }

    func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any],
    ) {
        receiveSnapshot(from: userInfo)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
    ) {
        receiveSnapshot(from: message)
    }
}
