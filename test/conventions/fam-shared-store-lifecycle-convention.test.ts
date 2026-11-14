import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..');
const moduleRoot = resolve(projectRoot, 'modules/fam-shared-store-lifecycle');
const config = JSON.parse(readFileSync(resolve(moduleRoot, 'expo-module.config.json'), 'utf8')) as {
  platforms?: string[];
  apple?: {
    modules?: string[];
    appDelegateSubscribers?: string[];
  };
  ios?: { podspecPath?: string };
  android?: unknown;
};
const swiftSource = readFileSync(resolve(moduleRoot, 'ios/FamSharedStoreLifecycle.swift'), 'utf8');
const podspecSource = readFileSync(
  resolve(moduleRoot, 'ios/FamSharedStoreLifecycle.podspec'),
  'utf8',
);

describe('shared store lifecycle native module contract', () => {
  it('registers only the iOS module and AppDelegate subscriber', () => {
    expect(config.platforms).toEqual(['ios']);
    expect(config.android).toBeUndefined();
    expect(config.apple?.modules).toEqual(['FamSharedStoreLifecycleModule']);
    expect(config.apple?.appDelegateSubscribers).toEqual([
      'FamSharedStoreLifecycleAppDelegateSubscriber',
    ]);
    expect(config.ios?.podspecPath).toBe('ios/FamSharedStoreLifecycle.podspec');
  });

  it('keeps the pod metadata limited to ExpoModulesCore', () => {
    expect(podspecSource).toContain("s.dependency 'ExpoModulesCore'");
    expect(podspecSource).not.toMatch(/s\.dependency(?! 'ExpoModulesCore')/);
    expect(podspecSource).not.toMatch(/WatchConnectivity|SQLCipher|SQLite/);
  });

  it('defines the owner, bridge, and AppDelegate subscriber with named lifecycle states', () => {
    expect(swiftSource).toContain('public final class FamSharedStoreLifecycleOwner');
    expect(swiftSource).toContain('public final class FamSharedStoreLifecycleModule: Module');
    expect(swiftSource).toContain(
      'public final class FamSharedStoreLifecycleAppDelegateSubscriber: ExpoAppDelegateSubscriber',
    );
    expect(swiftSource).toContain('case active');
    expect(swiftSource).toContain('case resigning');
    expect(swiftSource).toContain('case background');
    expect(swiftSource).toContain('case suspended');
    expect(swiftSource).toContain('UIApplication.shared.applicationState');
    expect(swiftSource).toContain('beginBackgroundTask(withName:');
    expect(swiftSource).toContain('endBackgroundTask(');
    expect(swiftSource).toContain('onLeaseExpired');
  });

  it('gates writers before React Native AppState and routes foreground activation through the owner', () => {
    const resigningIndex = swiftSource.indexOf('applicationWillResignActive');
    const resigningStateIndex = swiftSource.indexOf('setState(.resigning)', resigningIndex);
    const becameActiveIndex = swiftSource.indexOf('applicationDidBecomeActive');
    const activeStateIndex = swiftSource.indexOf('setState(.active)', becameActiveIndex);

    expect(resigningIndex).toBeGreaterThanOrEqual(0);
    expect(resigningStateIndex).toBeGreaterThan(resigningIndex);
    expect(becameActiveIndex).toBeGreaterThan(resigningIndex);
    expect(activeStateIndex).toBeGreaterThan(becameActiveIndex);
    expect(swiftSource).toMatch(/guard state == \.active else/);
  });

  it('keeps foreground admission suspended until every expired lease has finished cleanup', () => {
    expect(swiftSource).toContain('private var requestedState: FamSharedStoreLifecycleState');
    expect(swiftSource).toContain('private func hasExpiredLeaseLocked() -> Bool');
    expect(swiftSource).toContain('private func hasBackgroundContextLocked() -> Bool');
    expect(swiftSource).toContain(
      'if hasExpiredLeaseLocked() && (requestedState == .active || requestedState == .background)',
    );
    expect(swiftSource).toContain('if hasBackgroundContextLocked() && requestedState == .active');
    expect(swiftSource).toContain('let effectiveState = effectiveStateLocked(nextState)');

    const finishLease = swiftSource.slice(
      swiftSource.indexOf('private func finishLease'),
      swiftSource.indexOf('private func endBackgroundTask'),
    );
    const endAssertionIndex = finishLease.indexOf('endBackgroundTask(lease.taskIdentifier)');
    const removeFenceIndex = finishLease.indexOf('leases.removeValue(forKey: token)');
    const restoreAdmissionIndex = finishLease.indexOf(
      'let effectiveState = effectiveStateLocked(requestedState)',
    );

    expect(endAssertionIndex).toBeGreaterThanOrEqual(0);
    expect(removeFenceIndex).toBeGreaterThan(endAssertionIndex);
    expect(restoreAdmissionIndex).toBeGreaterThan(removeFenceIndex);
  });

  it('keeps an expiring assertion alive until the owner performs cleanup', () => {
    const expiration = swiftSource.slice(
      swiftSource.indexOf('private func expireLease'),
      swiftSource.indexOf('private func finishLease'),
    );

    expect(expiration).toContain('state = .suspended');
    expect(expiration).toContain('expired = true');
    expect(expiration).not.toContain('endBackgroundTask(');
    expect(swiftSource).toContain('var expired: Bool');
    expect(swiftSource).toContain('guard var storedLease = leases[token]');
    expect(swiftSource).toContain('leases.removeValue(forKey: token)');
  });

  it('rechecks admission on the main queue before beginning a background task', () => {
    expect(swiftSource).toContain('allowedState: FamSharedStoreLifecycleState');
    expect(swiftSource).toContain('state == allowedState');
    expect(swiftSource).toContain(
      'attachBackgroundTask(token: token, name: name, allowedState: .active)',
    );
    expect(swiftSource).toContain(
      'attachBackgroundTask(token: token, name: name, allowedState: .background)',
    );
  });

  it('keeps UIKit lifecycle assertions out of Siri and Android surfaces', () => {
    expect(config.platforms).not.toContain('android');
    expect(swiftSource).not.toContain('Siri');
  });
});
