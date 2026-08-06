import { detectReconnect } from '@/lib/sync/reconnect';

describe('detectReconnect', () => {
  it('false -> true ist ein Reconnect', () => {
    expect(detectReconnect(false, true)).toBe(true);
  });

  it('true -> true ist kein Reconnect (bereits online)', () => {
    expect(detectReconnect(true, true)).toBe(false);
  });

  it('false -> false ist kein Reconnect (weiterhin offline)', () => {
    expect(detectReconnect(false, false)).toBe(false);
  });

  it('true -> false ist kein Reconnect (das ist ein Disconnect)', () => {
    expect(detectReconnect(true, false)).toBe(false);
  });

  it('null -> true ist KEIN Reconnect — noch nie beobachtet zaehlt nicht als vorheriger Offline-Zustand', () => {
    expect(detectReconnect(null, true)).toBe(false);
  });

  it('null -> false ist kein Reconnect', () => {
    expect(detectReconnect(null, false)).toBe(false);
  });
});
