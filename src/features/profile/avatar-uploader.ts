import * as ImagePicker from 'expo-image-picker';
import { getSupabase } from '@/lib/backend/supabase/client';
import { env } from '@/lib/config/env';
import { debugError } from '@/lib/observability/debug-log';
/**
 * Oeffnet die native Foto-Auswahl mit quadratischem Zuschnitt (1:1).
 */
export async function pickAvatarImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function uploadAvatarImage(localUri: string): Promise<string> {
  try {
    const supabase = getSupabase();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError ?? new Error('Not authenticated');
    }
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const bytes = await new File(localUri).bytes();

    const path = `${user.id}/avatar.jpg`;

    const storage = supabase.storage.from('avatars');
    const upload = () => storage.upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    let { error } = await upload();

    // iOS can lose the HTTP response. Repeat the same upsert and require confirmation;
    // an existing object alone could still be the previous avatar.
    for (const delayMs of [250, 750]) {
      if (
        error?.name !== 'StorageUnknownError' ||
        !/fetch failed|network request failed|parsen der antwort|cannot parse response/iu.test(
          error.message,
        )
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      ({ error } = await upload());
    }

    if (error) throw error;

    // Stable locator only. AvatarImage resolves a short-lived signed URL for display.
    return `${env.supabaseUrl}/storage/v1/object/authenticated/avatars/${path}`;
  } catch (error: unknown) {
    debugError('[AvatarUpload] Upload fehlgeschlagen', error);
    throw new Error('Profilbild konnte nicht hochgeladen werden. Bitte versuche es erneut.', {
      cause: error,
    });
  }
}
