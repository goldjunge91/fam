import { type EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';

export type SharedStoreLifecycleState = 'active' | 'resigning' | 'background' | 'suspended';

export type SharedStoreLeaseKind = 'writer' | 'background';

export type SharedStoreLease = {
  readonly kind: SharedStoreLeaseKind;
  readonly name: string;
  readonly token: string;
  readonly signal: AbortSignal;
  readonly ended: boolean;
  end(): void;
};

export type SharedStoreWriterLease = Pick<SharedStoreLease, 'signal' | 'ended' | 'end'>;

export type SharedStoreWriterOwner = {
  beginWriterLease(name: string, options?: { signal?: AbortSignal }): SharedStoreWriterLease | null;
};

type NativeLeaseExpiredEvent = {
  token?: unknown;
  reason?: unknown;
};

type NativeStateChangeEvent = {
  state?: unknown;
};

type SharedStoreLifecycleNativeModule = {
  getState(): string;
  beginWriterLease(name: string): string | null;
  beginBackgroundContext(name: string): string | null;
  endLease(token: string): void;
  addListener(
    eventName: 'onStateChange',
    listener: (event: NativeStateChangeEvent) => void,
  ): EventSubscription;
  addListener(
    eventName: 'onLeaseExpired',
    listener: (event: NativeLeaseExpiredEvent) => void,
  ): EventSubscription;
};

const nativeModule =
  requireOptionalNativeModule<SharedStoreLifecycleNativeModule>('FamSharedStoreLifecycle');

const lifecycleStates: readonly SharedStoreLifecycleState[] = [
  'active',
  'resigning',
  'background',
  'suspended',
];

const lifecycleListeners = new Set<(state: SharedStoreLifecycleState) => void>();
const activeLeases = new Map<string, LeaseControl>();
let fallbackTokenSequence = 0;

type LeaseControl = {
  isEnded: () => boolean;
  end: () => void;
  expire: (reason: unknown) => void;
};

function isLifecycleState(value: unknown): value is SharedStoreLifecycleState {
  return typeof value === 'string' && lifecycleStates.includes(value as SharedStoreLifecycleState);
}

function readNativeState(): SharedStoreLifecycleState {
  if (!nativeModule) return 'active';

  try {
    const state = nativeModule.getState();
    return isLifecycleState(state) ? state : 'suspended';
  } catch {
    return 'suspended';
  }
}

function canBegin(kind: SharedStoreLeaseKind): boolean {
  if (!nativeModule) return true;

  const state = readNativeState();
  return kind === 'writer' ? state === 'active' : state === 'background';
}

function createFallbackToken(kind: SharedStoreLeaseKind): string {
  fallbackTokenSequence += 1;
  return `fallback-${kind}-${fallbackTokenSequence}`;
}

function createLease(
  kind: SharedStoreLeaseKind,
  name: string,
  nativeToken: string | null,
  externalSignal?: AbortSignal,
): SharedStoreLease {
  const token = nativeToken ?? createFallbackToken(kind);
  const controller = new AbortController();
  let ended = false;
  let removeExternalAbortListener = () => {};

  const end = () => {
    if (ended) return;

    ended = true;
    activeLeases.delete(token);
    removeExternalAbortListener();

    if (nativeModule && nativeToken) {
      nativeModule.endLease(nativeToken);
    }
  };

  const expire = (reason: unknown) => {
    if (ended) return;

    // Expiration aborts the owner immediately, but the native assertion remains
    // owned until the caller has rolled back, closed resources, and invokes end.
    // This preserves the required cleanup ordering across the JS/native boundary.
    controller.abort(reason);
  };

  const control: LeaseControl = {
    isEnded: () => ended,
    end,
    expire,
  };

  if (externalSignal) {
    const onExternalAbort = () => {
      if (!ended) controller.abort(externalSignal.reason);
      // The caller owns native release. Cleanup may still need the assertion
      // after cancellation, for example to rollback or detach an open resource.
    };
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    removeExternalAbortListener = () =>
      externalSignal.removeEventListener('abort', onExternalAbort);
    if (externalSignal.aborted) onExternalAbort();
  }

  if (nativeToken && !ended) activeLeases.set(nativeToken, control);

  return {
    kind,
    name,
    token,
    signal: controller.signal,
    get ended() {
      return control.isEnded();
    },
    end,
  };
}

function beginLease(
  kind: SharedStoreLeaseKind,
  name: string,
  externalSignal?: AbortSignal,
): SharedStoreLease | null {
  if (externalSignal?.aborted || !canBegin(kind)) return null;

  if (!nativeModule) return createLease(kind, name, null, externalSignal);

  let nativeToken: string | null;
  try {
    nativeToken =
      kind === 'writer'
        ? nativeModule.beginWriterLease(name)
        : nativeModule.beginBackgroundContext(name);
  } catch {
    return null;
  }

  if (!nativeToken) return null;
  return createLease(kind, name, nativeToken, externalSignal);
}

function handleStateChange(event: NativeStateChangeEvent): void {
  if (!isLifecycleState(event.state)) return;

  for (const listener of lifecycleListeners) listener(event.state);
}

function handleLeaseExpiration(event: NativeLeaseExpiredEvent): void {
  if (typeof event.token !== 'string') return;
  activeLeases.get(event.token)?.expire(event.reason ?? 'native-expiration');
}

function subscribeToNativeEvents(): void {
  if (!nativeModule) return;

  nativeModule.addListener('onStateChange', handleStateChange);
  nativeModule.addListener('onLeaseExpired', handleLeaseExpiration);
}

subscribeToNativeEvents();

export function getSharedStoreLifecycleState(): SharedStoreLifecycleState {
  return readNativeState();
}

export function beginForegroundWriter(
  name: string,
  options: { signal?: AbortSignal } = {},
): SharedStoreLease | null {
  return beginLease('writer', name, options.signal);
}

export const sharedStoreWriterOwner: SharedStoreWriterOwner = {
  beginWriterLease: (name, options) => beginForegroundWriter(name, options),
};

export function requireSharedStoreWriter(
  owner: SharedStoreWriterOwner,
  name: string,
  signal?: AbortSignal,
): SharedStoreWriterLease {
  const lease = owner.beginWriterLease(name, { signal });
  if (!lease) {
    throw new Error(
      `Der native Schreibzugriff ist im aktuellen Lifecycle nicht zugelassen. (${name})`,
    );
  }
  if (lease.signal.aborted || lease.ended) {
    lease.end();
    throw new Error('Die native Schreibzusicherung ist abgelaufen.');
  }
  return lease;
}

export async function withSharedStoreWriter<T>(
  owner: SharedStoreWriterOwner,
  name: string,
  operation: (lease: SharedStoreWriterLease) => Promise<T> | T,
  signal?: AbortSignal,
): Promise<T> {
  const lease = requireSharedStoreWriter(owner, name, signal);
  try {
    if (lease.signal.aborted || lease.ended)
      throw new Error('Die native Schreibzusicherung ist abgelaufen.');
    const result = await operation(lease);
    if (lease.signal.aborted || lease.ended)
      throw new Error('Die native Schreibzusicherung ist abgelaufen.');
    return result;
  } finally {
    lease.end();
  }
}

export function withSharedStoreWriterSync<T>(
  owner: SharedStoreWriterOwner,
  name: string,
  operation: (lease: SharedStoreWriterLease) => T,
  signal?: AbortSignal,
): T {
  const lease = requireSharedStoreWriter(owner, name, signal);
  try {
    if (lease.signal.aborted || lease.ended)
      throw new Error('Die native Schreibzusicherung ist abgelaufen.');
    const result = operation(lease);
    if (lease.signal.aborted || lease.ended)
      throw new Error('Die native Schreibzusicherung ist abgelaufen.');
    return result;
  } finally {
    lease.end();
  }
}

/**
 * Adapts an explicitly admitted background context to the writer port. The
 * context owns the native assertion; borrowed writer leases only scope each
 * database operation and therefore never end the context itself.
 */
export function createSharedStoreWriterOwner(
  backgroundContext?: SharedStoreLease,
): SharedStoreWriterOwner {
  if (!backgroundContext) return sharedStoreWriterOwner;

  return {
    beginWriterLease(_name, options = {}) {
      if (
        backgroundContext.kind !== 'background' ||
        backgroundContext.ended ||
        backgroundContext.signal.aborted ||
        options.signal?.aborted
      ) {
        return null;
      }

      const controller = new AbortController();
      let ended = false;
      let removeContextAbortListener = () => {};
      let removeExternalAbortListener = () => {};

      const end = () => {
        if (ended) return;
        ended = true;
        removeContextAbortListener();
        removeExternalAbortListener();
      };
      const expire = (reason: unknown) => {
        if (ended) return;
        controller.abort(reason);
        end();
      };
      const onContextAbort = () => expire(backgroundContext.signal.reason);
      const onExternalAbort = () => expire(options.signal?.reason);

      backgroundContext.signal.addEventListener('abort', onContextAbort, { once: true });
      removeContextAbortListener = () =>
        backgroundContext.signal.removeEventListener('abort', onContextAbort);
      if (options.signal) {
        options.signal.addEventListener('abort', onExternalAbort, { once: true });
        removeExternalAbortListener = () =>
          options.signal?.removeEventListener('abort', onExternalAbort);
      }

      if (backgroundContext.signal.aborted) onContextAbort();
      if (options.signal?.aborted) onExternalAbort();

      return {
        signal: controller.signal,
        get ended() {
          return ended;
        },
        end,
      } satisfies SharedStoreWriterLease;
    },
  };
}

export function beginBackgroundContext(
  name: string,
  options: { signal?: AbortSignal } = {},
): SharedStoreLease | null {
  return beginLease('background', name, options.signal);
}

export function subscribeSharedStoreLifecycle(
  listener: (state: SharedStoreLifecycleState) => void,
): () => void {
  lifecycleListeners.add(listener);
  return () => lifecycleListeners.delete(listener);
}
