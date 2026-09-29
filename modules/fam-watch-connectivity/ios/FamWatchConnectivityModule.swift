import ExpoModulesCore
import Foundation
import WatchConnectivity

public final class FamWatchConnectivityModule: Module {
  private let snapshotTransfer = WatchSnapshotTransfer.shared

  public func definition() -> ModuleDefinition {
    Name("FamWatchConnectivity")
    Events("onWatchToggle")

    OnStartObserving("onWatchToggle") {
      self.snapshotTransfer.startObservingWatchToggles { [weak self] householdID, itemID, isChecked in
        DispatchQueue.main.async {
          self?.sendEvent("onWatchToggle", [
            "householdId": householdID,
            "itemId": itemID,
            "isChecked": isChecked,
          ])
        }
      }
    }

    OnStopObserving("onWatchToggle") {
      self.snapshotTransfer.stopObservingWatchToggles()
    }

    Function("publishSnapshot") { (snapshotJSON: String) in
      self.snapshotTransfer.publish(snapshotJSON)
    }
  }
}

private final class WatchSnapshotTransfer: NSObject, WCSessionDelegate {
  static let shared = WatchSnapshotTransfer()

  private let queue = DispatchQueue(label: "com.goldjunge91.fam.watch-connectivity")
  private var session: WCSession?
  private var latestSnapshotJSON: String?
  private var activationRequested = false
  private var watchToggleHandler: ((String, String, Bool) -> Void)?

  private override init() {
    super.init()
  }

  func publish(_ snapshotJSON: String) {
    queue.async {
      self.latestSnapshotJSON = snapshotJSON
      self.activateSessionIfNeeded()
      self.transferLatestSnapshotIfReady()
    }
  }

  func startObservingWatchToggles(
    handler: @escaping (String, String, Bool) -> Void
  ) {
    queue.async {
      self.watchToggleHandler = handler
      self.activateSessionIfNeeded()
    }
  }

  func stopObservingWatchToggles() {
    queue.async {
      self.watchToggleHandler = nil
    }
  }

  private func activateSessionIfNeeded() {
    guard WCSession.isSupported(), !activationRequested else { return }

    let session = WCSession.default
    session.delegate = self
    self.session = session
    activationRequested = true
    session.activate()
  }

  private func transferLatestSnapshotIfReady() {
    guard let session,
          session.activationState == .activated,
          let latestSnapshotJSON
    else {
      return
    }

    do {
      try session.updateApplicationContext(["snapshot": latestSnapshotJSON])
    } catch {
      NSLog("WatchConnectivity snapshot transfer failed: %@", error.localizedDescription)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    queue.async {
      if let error {
        NSLog("WatchConnectivity activation failed: %@", error.localizedDescription)
      }

      guard activationState == .activated else { return }
      self.transferLatestSnapshotIfReady()
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    queue.async {
      session.activate()
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receiveWatchToggle(from: message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    receiveWatchToggle(from: userInfo)
  }

  private func receiveWatchToggle(from payload: [String: Any]) {
    guard payload["type"] as? String == "shopping_item.toggle",
          let householdID = payload["household_id"] as? String,
          !householdID.isEmpty,
          let itemID = payload["item_id"] as? String,
          !itemID.isEmpty,
          let isChecked = payload["checked"] as? Bool
    else {
      return
    }

    queue.async {
      self.watchToggleHandler?(householdID, itemID, isChecked)
    }
  }
}
