import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { useDashboardEditMode } from './use-dashboard-edit-mode';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(),
}));

test('manages edit and gallery state with the expected feedback', async () => {
  const { result } = await renderHook(() => useDashboardEditMode());

  expect(result.current.isEditing).toBe(false);
  expect(result.current.isGalleryOpen).toBe(false);

  await act(async () => result.current.openGallery());
  await act(async () => result.current.enterEditMode());
  expect(result.current.isGalleryOpen).toBe(true);
  expect(result.current.isEditing).toBe(true);

  await act(async () => result.current.toggleEditMode());
  expect(result.current.isEditing).toBe(false);
  expect(result.current.isGalleryOpen).toBe(false);

  await act(async () => result.current.toggleEditMode());
  expect(result.current.isEditing).toBe(true);
  await act(async () => result.current.closeGallery());
  await act(async () => result.current.exitEditMode());
  expect(result.current.isEditing).toBe(false);
  expect(result.current.isGalleryOpen).toBe(false);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(5);
});
