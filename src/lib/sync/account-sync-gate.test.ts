import {
  beginAccountSyncRun,
  registerAccountSyncStopper,
  resumeAccountSync,
  stopAccountSyncAndWait,
} from './account-sync-gate';

describe('account sync gate', () => {
  beforeEach(() => {
    resumeAccountSync();
  });

  it('stoppt Abos und wartet laufende Syncs vor dem Cleanup ab', async () => {
    const stop = jest.fn();
    const unregister = registerAccountSyncStopper(stop);
    const finishRun = beginAccountSyncRun();
    let drained = false;

    const draining = stopAccountSyncAndWait().then(() => {
      drained = true;
    });
    await Promise.resolve();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(drained).toBe(false);
    expect(beginAccountSyncRun()).toBeNull();

    finishRun?.();
    await draining;
    expect(drained).toBe(true);
    unregister();
  });

  it('lässt den nächsten Account nach explizitem Resume wieder synchronisieren', async () => {
    await stopAccountSyncAndWait();
    expect(beginAccountSyncRun()).toBeNull();

    resumeAccountSync();
    const finishRun = beginAccountSyncRun();
    expect(finishRun).toEqual(expect.any(Function));
    finishRun?.();
  });

  it('stoppt ein während des Übergangs verspätet registriertes Abo sofort', async () => {
    await stopAccountSyncAndWait();
    const lateStopper = jest.fn();

    registerAccountSyncStopper(lateStopper);
    await Promise.resolve();

    expect(lateStopper).toHaveBeenCalledTimes(1);
  });

  it('meldet einen fehlgeschlagenen Stopper erst nach dem Drain fail-closed', async () => {
    const unregister = registerAccountSyncStopper(() => Promise.reject(new Error('stop failed')));
    const finishRun = beginAccountSyncRun();
    let settled = false;

    const stopping = stopAccountSyncAndWait().finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    finishRun?.();
    await expect(stopping).rejects.toThrow(/nicht sicher gestoppt/);
    expect(beginAccountSyncRun()).toBeNull();
    unregister();
  });
});
