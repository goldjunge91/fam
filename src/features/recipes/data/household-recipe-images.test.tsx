import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugError } from '@/lib/observability/debug-log';
import {
  uploadRecipeCoverImage,
  uploadRecipeStepImage,
  useRecipeCoverUrl,
  useRecipeStepImageUrl,
} from './household-recipe-images';

const mockFileState = {
  uri: '',
  bytes: jest.fn<Promise<Uint8Array>, []>(),
};
const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
}));
const mockGetSession = jest.fn();
const mockSupabase = {
  storage: { from: mockStorageFrom },
  auth: { getSession: mockGetSession },
};

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    constructor(uri: string) {
      mockFileState.uri = uri;
    }

    bytes() {
      return mockFileState.bytes();
    }
  },
}));
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));
jest.mock('@/lib/observability/debug-log', () => ({ debugError: jest.fn() }));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('household recipe images', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileState.bytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed-image' },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    jest
      .mocked(getSupabase)
      .mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabase>);
  });

  it('uploads a JPEG cover and reports storage failures', async () => {
    await expect(
      uploadRecipeCoverImage('file://cover.jpg', 'household-1', 'recipe-1'),
    ).resolves.toBe('household-1/recipe-1.jpg');

    expect(mockFileState.uri).toBe('file://cover.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('recipe-covers');
    expect(mockUpload).toHaveBeenCalledWith('household-1/recipe-1.jpg', new Uint8Array([1, 2, 3]), {
      contentType: 'image/jpeg',
      upsert: true,
    });

    mockUpload.mockResolvedValueOnce({ error: { message: 'Storage unavailable' } });
    await expect(
      uploadRecipeCoverImage('file://cover.jpg', 'household-1', 'recipe-1'),
    ).rejects.toThrow('Storage unavailable');
  });

  it('uses distinct step-image paths with and without a stable image id', async () => {
    await expect(
      uploadRecipeStepImage('file://step.jpg', 'household-1', 'step-1', 'image-1'),
    ).resolves.toBe('household-1/step-1/image-1.jpg');
    await expect(uploadRecipeStepImage('file://step.jpg', 'household-1', 'step-1')).resolves.toBe(
      'household-1/step-1.jpg',
    );

    expect(mockStorageFrom).toHaveBeenCalledWith('recipe-step-images');
  });

  it('skips empty paths and uses an existing URL directly', async () => {
    const empty = await renderHook(() => useRecipeCoverUrl(null), { wrapper: createWrapper() });
    expect(empty.result.current.data).toBeUndefined();
    expect(getSupabase).not.toHaveBeenCalled();

    const remote = await renderHook(() => useRecipeCoverUrl('https://cdn.example/cover.jpg'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(remote.result.current.data).toBe('https://cdn.example/cover.jpg'));
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it('signs private cover and step images with the appropriate buckets', async () => {
    const cover = await renderHook(() => useRecipeCoverUrl('household-1/recipe-1.jpg'), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(cover.result.current.data).toBe('https://storage.example/signed-image'),
    );

    const step = await renderHook(() => useRecipeStepImageUrl('household-1/step-1/image-1.jpg'), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(step.result.current.data).toBe('https://storage.example/signed-image'),
    );
    expect(mockStorageFrom).toHaveBeenNthCalledWith(1, 'recipe-covers');
    expect(mockStorageFrom).toHaveBeenNthCalledWith(2, 'recipe-step-images');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('household-1/step-1/image-1.jpg', 3600);
  });

  it('logs a signed URL failure in development and exposes the error', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not authorized' },
    });

    const hook = await renderHook(() => useRecipeStepImageUrl('household-1/private.jpg'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.error).toEqual(new Error('Not authorized'));
    if (__DEV__) {
      expect(mockGetSession).toHaveBeenCalledTimes(1);
      expect(debugError).toHaveBeenCalledWith('[RecipeStepImage] signed-url:error', {
        path: 'household-1/private.jpg',
        authenticated: true,
        message: 'Not authorized',
      });
    }
  });
});
