const mockReportError = jest.fn();

jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setWindow(value: unknown): void {
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
}

function removeWindow(): void {
  Reflect.deleteProperty(globalThis, 'window');
}

function loadWebCompletion() {
  let completion: typeof import('./onboarding-completion.web') | undefined;
  jest.isolateModules(() => {
    completion =
      require('./onboarding-completion.web') as typeof import('./onboarding-completion.web');
  });
  if (!completion) throw new Error('Web onboarding completion module was not loaded');
  return completion;
}

describe('web onboarding completion storage', () => {
  beforeEach(() => {
    mockReportError.mockReset();
  });

  afterEach(() => {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      removeWindow();
    }
  });

  it('persists the marker and exposes completion for the current session', async () => {
    const localStorage = {
      getItem: jest.fn().mockReturnValue('true'),
      setItem: jest.fn(),
    };
    setWindow({ localStorage });
    const completion = loadWebCompletion();

    await completion.persistOnboardingCompleted();

    expect(localStorage.setItem).toHaveBeenCalledWith('fam_onboarding_completed_v1', 'true');
    await expect(completion.hasSeenOnboarding()).resolves.toBe(true);
    expect(completion.isOnboardingSessionCompleted()).toBe(true);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('falls back to memory when browser storage throws', async () => {
    setWindow({
      localStorage: {
        getItem: () => {
          throw new Error('storage blocked');
        },
        setItem: () => {
          throw new Error('storage blocked');
        },
      },
    });
    const completion = loadWebCompletion();

    await expect(completion.hasSeenOnboarding()).resolves.toBe(false);
    await completion.persistOnboardingCompleted();
    await expect(completion.hasSeenOnboarding()).resolves.toBe(true);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('uses memory storage when no browser window exists', async () => {
    removeWindow();
    const completion = loadWebCompletion();

    await expect(completion.hasSeenOnboarding()).resolves.toBe(false);
    await completion.persistOnboardingCompleted();
    await expect(completion.hasSeenOnboarding()).resolves.toBe(true);
  });
});
