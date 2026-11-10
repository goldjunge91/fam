import { getDevAiModelSelection } from './dev-ai-model-selection';

const mockGetState = jest.fn();

jest.mock('@/constants/dev-settings', () => ({
  useDevSettingsStore: {
    getState: () => mockGetState(),
  },
}));

describe('getDevAiModelSelection', () => {
  const devGlobal = globalThis as typeof globalThis & { __DEV__?: boolean };
  const originalDev = devGlobal.__DEV__;

  afterEach(() => {
    devGlobal.__DEV__ = originalDev;
    mockGetState.mockReset();
  });

  it('returns the valid development provider and model', () => {
    devGlobal.__DEV__ = true;
    mockGetState.mockReturnValue({
      aiProvider: 'groq',
      aiModel: 'qwen/qwen3.8-27b',
    });

    expect(getDevAiModelSelection()).toEqual({
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
    });
  });

  it.each([
    { aiProvider: 'unknown', aiModel: 'qwen/qwen3.8-27b' },
    { aiProvider: 'groq', aiModel: '' },
    { aiProvider: 'groq', aiModel: 'not valid' },
  ])('rejects an invalid selection: %o', (selection) => {
    devGlobal.__DEV__ = true;
    mockGetState.mockReturnValue(selection);

    expect(getDevAiModelSelection()).toBeNull();
  });

  it('returns null outside development builds', () => {
    devGlobal.__DEV__ = false;
    mockGetState.mockReturnValue({
      aiProvider: 'groq',
      aiModel: 'qwen/qwen3.8-27b',
    });

    expect(getDevAiModelSelection()).toBeNull();
    expect(mockGetState).not.toHaveBeenCalled();
  });
});
