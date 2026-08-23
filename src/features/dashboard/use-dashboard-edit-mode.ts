import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';

export function useDashboardEditMode() {
  const [isEditing, setIsEditing] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const enterEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsEditing(true);
  }, []);

  const exitEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditing(false);
    setIsGalleryOpen(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    if (isEditing) {
      exitEditMode();
    } else {
      enterEditMode();
    }
  }, [isEditing, enterEditMode, exitEditMode]);

  const openGallery = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGalleryOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false);
  }, []);

  return {
    isEditing,
    isGalleryOpen,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
    openGallery,
    closeGallery,
  } as const;
}
