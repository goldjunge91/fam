import ExpoModulesCore
import Foundation
import UIKit

public enum FamSharedStoreLifecycleState: String {
  case active
  case resigning
  case background
  case suspended
}

public enum FamSharedStoreLeaseKind: String {
  case writer
  case background
}

public final class FamSharedStoreLifecycleOwner {
  public static let shared = FamSharedStoreLifecycleOwner()

  public typealias StateObserver = (FamSharedStoreLifecycleState) -> Void
  public typealias LeaseExpirationObserver = (String, String, FamSharedStoreLeaseKind, String) -> Void

  private struct Lease {
    let token: String
    let name: String
    let kind: FamSharedStoreLeaseKind
    var taskIdentifier: UIBackgroundTaskIdentifier
    var ended: Bool
    var expired: Bool
  }

  private let lock = NSLock()
  private var requestedState: FamSharedStoreLifecycleState
  private var state: FamSharedStoreLifecycleState
  private var leases: [String: Lease] = [:]
  private var stateObservers: [UUID: StateObserver] = [:]
  private var expirationObservers: [UUID: LeaseExpirationObserver] = [:]
  private var tokenSequence = 0

  private init() {
    let initialState = Self.initialState()
    requestedState = initialState
    state = initialState
  }

  public var currentState: FamSharedStoreLifecycleState {
    lock.lock()
    defer { lock.unlock() }
    return state
  }

  @discardableResult
  public func setState(_ nextState: FamSharedStoreLifecycleState) -> Bool {
    let observers: [StateObserver]

    lock.lock()
    requestedState = nextState
    let effectiveState = effectiveStateLocked(nextState)
    guard state != effectiveState else {
      lock.unlock()
      return false
    }
    state = effectiveState
    observers = Array(stateObservers.values)
    lock.unlock()

    observers.forEach { $0(effectiveState) }
    return true
  }

  public func beginWriterLease(name: String) -> String? {
    guard Self.isValidName(name) else { return nil }

    lock.lock()
    guard state == .active else {
      lock.unlock()
      return nil
    }
    let token = reserveLeaseLocked(name: name, kind: .writer)
    lock.unlock()

    return attachBackgroundTask(token: token, name: name, allowedState: .active)
  }

  public func beginBackgroundContext(name: String) -> String? {
    guard Self.isValidName(name) else { return nil }

    lock.lock()
    guard state == .background else {
      lock.unlock()
      return nil
    }
    let token = reserveLeaseLocked(name: name, kind: .background)
    lock.unlock()

    return attachBackgroundTask(token: token, name: name, allowedState: .background)
  }

  public func endLease(token: String) {
    finishLease(token: token)
  }

  @discardableResult
  public func addStateObserver(_ observer: @escaping StateObserver) -> UUID {
    let id = UUID()
    lock.lock()
    stateObservers[id] = observer
    lock.unlock()
    return id
  }

  public func removeStateObserver(_ id: UUID) {
    lock.lock()
    stateObservers.removeValue(forKey: id)
    lock.unlock()
  }

  @discardableResult
  public func addLeaseExpirationObserver(_ observer: @escaping LeaseExpirationObserver) -> UUID {
    let id = UUID()
    lock.lock()
    expirationObservers[id] = observer
    lock.unlock()
    return id
  }

  public func removeLeaseExpirationObserver(_ id: UUID) {
    lock.lock()
    expirationObservers.removeValue(forKey: id)
    lock.unlock()
  }

  private func reserveLeaseLocked(name: String, kind: FamSharedStoreLeaseKind) -> String {
    tokenSequence += 1
    let token = "\(kind.rawValue)-\(tokenSequence)-\(UUID().uuidString)"
    leases[token] = Lease(
      token: token,
      name: name,
      kind: kind,
      taskIdentifier: .invalid,
      ended: false,
      expired: false
    )
    return token
  }

  private func attachBackgroundTask(
    token: String,
    name: String,
    allowedState: FamSharedStoreLifecycleState
  ) -> String? {
    // Admission and beginBackgroundTask run in one main-queue critical section.
    // This closes the gap in which applicationWillResignActive could otherwise
    // win after the state check but before the UIKit assertion starts.
    let taskIdentifier = performOnMain {
      lock.lock()
      guard let lease = leases[token], !lease.ended, state == allowedState else {
        lock.unlock()
        return UIBackgroundTaskIdentifier.invalid
      }
      let taskIdentifier = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
        self?.expireLease(token: token, reason: "expiration")
      }
      lock.unlock()
      return taskIdentifier
    }

    lock.lock()
    guard var lease = leases[token], !lease.ended, !lease.expired else {
      lock.unlock()
      // The token was never returned to JavaScript. End the just-created UIKit
      // assertion first, then remove the expired admission fence ourselves.
      endBackgroundTask(taskIdentifier)
      finishLease(token: token)
      return nil
    }

    guard taskIdentifier != .invalid else {
      lock.unlock()
      finishLease(token: token)
      return nil
    }

    lease.taskIdentifier = taskIdentifier
    leases[token] = lease
    lock.unlock()
    return token
  }

  private func expireLease(token: String, reason: String) {
    let lease: Lease
    let stateObservers: [StateObserver]
    let expirationObservers: [LeaseExpirationObserver]

    lock.lock()
    guard var storedLease = leases[token], !storedLease.ended, !storedLease.expired else {
      lock.unlock()
      return
    }
    storedLease.expired = true
    leases[token] = storedLease
    let stateChanged = state != .suspended
    state = .suspended
    stateObservers = stateChanged ? Array(self.stateObservers.values) : []
    expirationObservers = Array(self.expirationObservers.values)
    lease = storedLease
    lock.unlock()

    // Do not end the UIKit assertion here. The JS owner must first abort the
    // operation, roll back, release SQLite resources, and call endLease.
    if stateChanged {
      stateObservers.forEach { $0(.suspended) }
    }
    expirationObservers.forEach {
      $0(lease.token, lease.name, lease.kind, reason)
    }
  }

  private func finishLease(token: String) {
    let lease: Lease

    lock.lock()
    guard var storedLease = leases[token], !storedLease.ended else {
      lock.unlock()
      return
    }
    storedLease.ended = true
    leases[token] = storedLease
    lease = storedLease
    lock.unlock()

    // Resource cleanup has completed before JavaScript calls endLease. End the
    // UIKit assertion before removing an expired token's admission fence.
    endBackgroundTask(lease.taskIdentifier)

    lock.lock()
    guard leases.removeValue(forKey: token) != nil else {
      lock.unlock()
      return
    }
    let effectiveState = effectiveStateLocked(requestedState)
    let stateChanged = state != effectiveState
    state = effectiveState
    let stateObservers = stateChanged ? Array(self.stateObservers.values) : []
    lock.unlock()

    if stateChanged {
      stateObservers.forEach { $0(effectiveState) }
    }
  }

  private func hasExpiredLeaseLocked() -> Bool {
    leases.values.contains { $0.expired }
  }

  private func hasBackgroundContextLocked() -> Bool {
    leases.values.contains { $0.kind == .background }
  }

  private func effectiveStateLocked(
    _ requestedState: FamSharedStoreLifecycleState
  ) -> FamSharedStoreLifecycleState {
    if hasExpiredLeaseLocked() && (requestedState == .active || requestedState == .background) {
      return .suspended
    }
    if hasBackgroundContextLocked() && requestedState == .active {
      return .suspended
    }
    return requestedState
  }

  private func endBackgroundTask(_ taskIdentifier: UIBackgroundTaskIdentifier) {
    guard taskIdentifier != .invalid else { return }
    performOnMain {
      UIApplication.shared.endBackgroundTask(taskIdentifier)
    }
  }

  private func performOnMain<T>(_ work: () -> T) -> T {
    if Thread.isMainThread {
      return work()
    }
    return DispatchQueue.main.sync(execute: work)
  }

  private static func initialState() -> FamSharedStoreLifecycleState {
    switch UIApplication.shared.applicationState {
    case .active:
      return .active
    case .inactive:
      return .resigning
    case .background:
      return .background
    @unknown default:
      return .suspended
    }
  }

  private static func isValidName(_ name: String) -> Bool {
    !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }
}

public final class FamSharedStoreLifecycleModule: Module {
  private let owner = FamSharedStoreLifecycleOwner.shared
  private var stateObserverID: UUID?
  private var expirationObserverID: UUID?

  public func definition() -> ModuleDefinition {
    Name("FamSharedStoreLifecycle")
    Events("onStateChange", "onLeaseExpired")

    Function("getState") {
      self.owner.currentState.rawValue
    }

    Function("beginWriterLease") { (name: String) -> String? in
      self.owner.beginWriterLease(name: name)
    }

    Function("beginBackgroundContext") { (name: String) -> String? in
      self.owner.beginBackgroundContext(name: name)
    }

    Function("endLease") { (token: String) in
      self.owner.endLease(token: token)
    }

    OnStartObserving("onStateChange") {
      guard self.stateObserverID == nil else { return }
      self.stateObserverID = self.owner.addStateObserver { [weak self] state in
        self?.sendEvent("onStateChange", ["state": state.rawValue])
      }
    }

    OnStopObserving("onStateChange") {
      self.removeStateObserver()
    }

    OnStartObserving("onLeaseExpired") {
      guard self.expirationObserverID == nil else { return }
      self.expirationObserverID = self.owner.addLeaseExpirationObserver {
        [weak self] token, name, kind, reason in
        self?.sendEvent("onLeaseExpired", [
          "token": token,
          "name": name,
          "kind": kind.rawValue,
          "reason": reason,
        ])
      }
    }

    OnStopObserving("onLeaseExpired") {
      self.removeExpirationObserver()
    }

    OnDestroy {
      self.removeStateObserver()
      self.removeExpirationObserver()
    }
  }

  private func removeStateObserver() {
    if let stateObserverID {
      owner.removeStateObserver(stateObserverID)
      self.stateObserverID = nil
    }
  }

  private func removeExpirationObserver() {
    if let expirationObserverID {
      owner.removeLeaseExpirationObserver(expirationObserverID)
      self.expirationObserverID = nil
    }
  }
}

public final class FamSharedStoreLifecycleAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private let owner = FamSharedStoreLifecycleOwner.shared

  public func applicationWillResignActive(_ application: UIApplication) {
    owner.setState(.resigning)
  }

  public func applicationDidEnterBackground(_ application: UIApplication) {
    owner.setState(.background)
  }

  public func applicationWillEnterForeground(_ application: UIApplication) {
    owner.setState(.resigning)
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    owner.setState(.active)
  }

  public func applicationWillTerminate(_ application: UIApplication) {
    owner.setState(.suspended)
  }
}
