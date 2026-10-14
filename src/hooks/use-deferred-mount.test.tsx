import { act, renderHook } from '@testing-library/react-native';
import { useDeferredMount } from './use-deferred-mount';

describe('useDeferredMount', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps content mounted until the close delay expires', async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ isOpen }: { isOpen: boolean }) => useDeferredMount(isOpen),
      { initialProps: { isOpen: true } },
    );

    expect(result.current).toBe(true);
    await rerender({ isOpen: false });
    expect(result.current).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
    await unmount();
  });

  it('cancels a pending unmount when the content reopens', async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ isOpen }: { isOpen: boolean }) => useDeferredMount(isOpen, 100),
      { initialProps: { isOpen: false } },
    );

    expect(result.current).toBe(false);
    await rerender({ isOpen: true });
    expect(result.current).toBe(true);
    await rerender({ isOpen: false });
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    await rerender({ isOpen: true });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
    await unmount();
  });
});
