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

/**
 * Laedt ein lokal ausgewaehltes Profilbild in den `avatars`-Bucket hoch.
 * Falls der Storage-Bucket nicht erreichbar ist (z. B. offline), wird die lokale URI/Base64 verwendet.
 */
export async function uploadAvatarImage(userId: string, localUri: string): Promise<string> {
  try {
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const bytes = await new File(localUri).bytes();

    const path = `${userId}/avatar.jpg`;
    const { error } = await getSupabase()
      .storage.from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

    if (!error) {
      const { data } = getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch {
    // Fallback auf lokale URI fuer Offline-Szenarien
  }

  return localUri;
}
