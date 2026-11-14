const mockRequireOptionalNativeModule = jest.fn();

type NativeLifecycleListener = (event: unknown) => void;

type NativeLifecycleModule = {
  getState: jest.Mock<string, []>;
  beginWriterLease: jest.Mock<string | null, [name: string]>;
  beginBackgroundContext: jest.Mock<string | null, [name: string]>;
  endLease: jest.Mock<void, [token: string]>;
  addListener: jest.Mock<
    { remove: jest.Mock<void, []> },
    [eventName: string, listener: NativeLifecycleListener]
  >;
};

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}));

describe('shared store lifecycle adapter', () => {
  let adapter: typeof import('./shared-store-lifecycle');

  function loadAdapter(nativeModule: NativeLifecycleModule | null) {
    mockRequireOptionalNativeModule.mockReturnValue(nativeModule);
    jest.isolateModules(() => {
      adapter = require('./shared-store-lifecycle') as typeof import('./shared-store-lifecycle');
    });
  }

  function nativeModule(overrides: Partial<NativeLifecycleModule> = {}): NativeLifecycleModule {
    return {
      getState: jest.fn().mockReturnValue('active'),
      beginWriterLease: jest.fn().mockReturnValue('writer-token-1'),
      beginBackgroundContext: jest.fn().mockReturnValue('background-token-1'),
      endLease: jest.fn(),
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockRequireOptionalNativeModule.mockReset();
  });

  it('keeps foreground writes available with an idempotent no-op lease when the native module is absent', () => {
    loadAdapter(null);

    expect(adapter.getSharedStoreLifecycleState()).toBe('active');
    const lease = adapter.beginForegroundWriter('local-db.insert');

    expect(lease).not.toBeNull();
    expect(lease?.kind).toBe('writer');
    expect(lease?.signal.aborted).toBe(false);
    expect(lease?.ended).toBe(false);

    lease?.end();
    lease?.end();

    expect(lease?.ended).toBe(true);
  });

  it('does not ask the native bridge for a foreground writer while resigning', () => {
    const native = nativeModule({ getState: jest.fn().mockReturnValue('resigning') });
    loadAdapter(native);

    expect(adapter.beginForegroundWriter('local-db.update')).toBeNull();
    expect(native.beginWriterLease).not.toHaveBeenCalled();
  });

  it('passes the writer name through and ends a native lease exactly once', () => {
    const native = nativeModule();
    loadAdapter(native);

    const lease = adapter.beginForegroundWriter('local-db.transaction');

    expect(native.beginWriterLease).toHaveBeenCalledWith('local-db.transaction');
    expect(lease).toMatchObject({
      kind: 'writer',
      name: 'local-db.transaction',
      token: 'writer-token-1',
    });

    lease?.end();
    lease?.end();

    expect(native.endLease).toHaveBeenCalledTimes(1);
    expect(native.endLease).toHaveBeenCalledWith('writer-token-1');
    expect(lease?.ended).toBe(true);
    expect(lease?.signal.aborted).toBe(false);
  });

  it('aborts an active lease but ends the native assertion only after caller cleanup', () => {
    const listeners = new Map<string, NativeLifecycleListener>();
    const native = nativeModule({
      addListener: jest.fn((eventName, listener) => {
        listeners.set(eventName, listener);
        return { remove: jest.fn() };
      }),
    });
    loadAdapter(native);

    const lease = adapter.beginForegroundWriter('local-db.commit');
    listeners.get('onLeaseExpired')?.({
      token: 'writer-token-1',
      reason: 'expiration',
    });

    expect(lease?.signal.aborted).toBe(true);
    expect(lease?.ended).toBe(false);
    expect(native.endLease).not.toHaveBeenCalled();

    lease?.end();
    lease?.end();
    expect(lease?.ended).toBe(true);
    expect(native.endLease).toHaveBeenCalledTimes(1);
    expect(native.endLease).toHaveBeenCalledWith('writer-token-1');
  });

  it('propagates caller abort without ending the native context before cleanup', () => {
    const controller = new AbortController();
    const native = nativeModule({ getState: jest.fn().mockReturnValue('background') });
    loadAdapter(native);

    const lease = adapter.beginBackgroundContext('background-sync', { signal: controller.signal });

    expect(native.beginBackgroundContext).toHaveBeenCalledWith('background-sync');
    expect(lease).toMatchObject({
      kind: 'background',
      name: 'background-sync',
      token: 'background-token-1',
    });

    controller.abort('task expired');

    expect(lease?.signal.aborted).toBe(true);
    expect(lease?.ended).toBe(false);
    expect(native.endLease).not.toHaveBeenCalled();

    lease?.end();
    expect(lease?.ended).toBe(true);
    expect(native.endLease).toHaveBeenCalledTimes(1);
    expect(native.endLease).toHaveBeenCalledWith('background-token-1');
  });

  it('fails closed for a new background context after suspension', () => {
    const native = nativeModule({ getState: jest.fn().mockReturnValue('suspended') });
    loadAdapter(native);

    expect(adapter.beginBackgroundContext('background-sync')).toBeNull();
    expect(native.beginBackgroundContext).not.toHaveBeenCalled();
  });

  it('propagates background expiration to borrowed writer leases', () => {
    const listeners = new Map<string, NativeLifecycleListener>();
    const native = nativeModule({
      getState: jest.fn().mockReturnValue('background'),
      addListener: jest.fn((eventName, listener) => {
        listeners.set(eventName, listener);
        return { remove: jest.fn() };
      }),
    });
    loadAdapter(native);

    const context = adapter.beginBackgroundContext('background-sync');
    if (!context) throw new Error('Expected a background context.');
    const owner = adapter.createSharedStoreWriterOwner(context);
    const writer = owner.beginWriterLease('background-sync.page');
    if (!writer) throw new Error('Expected a borrowed writer lease.');

    listeners.get('onLeaseExpired')?.({
      token: 'background-token-1',
      reason: 'expiration',
    });

    expect(writer.signal.aborted).toBe(true);
    expect(writer.ended).toBe(true);
    writer.end();
    expect(native.endLease).not.toHaveBeenCalled();
  });

  it('forwards native state changes to subscribers and supports unsubscribe', () => {
    const listeners = new Map<string, NativeLifecycleListener>();
    const native = nativeModule({
      addListener: jest.fn((eventName, listener) => {
        listeners.set(eventName, listener);
        return { remove: jest.fn() };
      }),
    });
    loadAdapter(native);
    const states: string[] = [];
    const unsubscribe = adapter.subscribeSharedStoreLifecycle((state) => states.push(state));

    listeners.get('onStateChange')?.({ state: 'background' });
    unsubscribe();
    listeners.get('onStateChange')?.({ state: 'active' });

    expect(states).toEqual(['background']);
  });
});
