import { bugBubbleConsole } from '@/lib/analytics/bug-bubble';
import { getDeviceStorage } from '@/lib/storage/local-device-storage';
import { getLifecycleLog, recordLifecycleEvent } from './lifecycle-log';

jest.mock('@/lib/analytics/bug-bubble', () => ({
  bugBubbleConsole: jest.fn(),
}));

jest.mock('@/lib/storage/local-device-storage', () => {
  const store = new Map<string, string>();
  return {
    getDeviceStorage: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
      remove: (key: string) => {
        store.delete(key);
      },
      clearAll: () => store.clear(),
    }),
  };
});

describe('lifecycle-log', () => {
  beforeEach(() => {
    getDeviceStorage().clearAll();
    jest.clearAllMocks();
  });

  it('gibt ohne Eintraege eine leere Liste zurueck', () => {
    expect(getLifecycleLog()).toEqual([]);
  });

  it('persistiert Ereignisse in Reihenfolge und spiegelt sie in die BugBubble-Konsole', () => {
    recordLifecycleEvent({ name: 'app.started', level: 'info' });
    recordLifecycleEvent({ name: 'app.backgrounded', level: 'info', detail: 'op=sync.run' });

    expect(getLifecycleLog().map((event) => event.name)).toEqual([
      'app.started',
      'app.backgrounded',
    ]);
    expect(bugBubbleConsole).toHaveBeenCalledWith(
      'info',
      '[lifecycle] app.backgrounded',
      'op=sync.run',
    );
  });

  it('begrenzt den Puffer auf die letzten 50 Ereignisse', () => {
    for (let index = 0; index < 55; index += 1) {
      recordLifecycleEvent({ name: `event.${index}`, level: 'debug' });
    }

    const events = getLifecycleLog();
    expect(events).toHaveLength(50);
    expect(events[0].name).toBe('event.5');
    expect(events.at(-1)?.name).toBe('event.54');
  });
});
