import * as ImagePicker from 'expo-image-picker';
import { getSupabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

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

export async function uploadAvatarImage(userId: string, localUri: string): Promise<string> {
  try {
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const bytes = await new File(localUri).bytes();

    const path = `${userId}/avatar.jpg`;
    const { error } = await getSupabase()
      .storage.from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    const { data } = getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path);
    // Der Pfad bleibt beim Upsert gleich, deshalb verhindert der Zeitstempel ein altes Cache-Bild.
    return `${data.publicUrl}?t=${Date.now()}`;
  } catch (error: unknown) {
    throw new Error('Profilbild konnte nicht hochgeladen werden. Bitte versuche es erneut.', {
      cause: error,
    });
  }
}
