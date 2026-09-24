import * as ImagePicker from 'expo-image-picker';
import { getSupabase } from '@/lib/backend/supabase/client';
import { env } from '@/lib/config/env';
import { debugError, debugLogEvent } from '@/lib/observability/debug-log';

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_LONG_EDGE = 1024;
const AVATAR_QUALITY_STEPS = [0.8, 0.68, 0.56, 0.44] as const;
const RETRY_DELAYS_MS = [250, 750] as const;

type AvatarImageResult = {
  uri: string;
  width: number;
  height: number;
};

type AvatarImageManipulator = {
  manipulateAsync(
    uri: string,
    actions: readonly ({ resize: { width: number } } | { resize: { height: number } })[],
    saveOptions: {
      base64: false;
      compress: number;
      format: 'jpeg';
    },
  ): Promise<AvatarImageResult>;
};

type AvatarFile = {
  delete(): void;
};

type AvatarFileSystem = {
  File: new (uri: string) => AvatarFile;
};

function loadImageManipulator(): AvatarImageManipulator {
  const module = require('expo-image-manipulator') as Partial<AvatarImageManipulator>;
  if (typeof module.manipulateAsync !== 'function') {
    throw new Error('Das Bildbearbeitungsmodul ist nicht verfügbar.');
  }
  return module as AvatarImageManipulator;
}

function loadFileSystem(): AvatarFileSystem {
  const module = require('expo-file-system') as Partial<AvatarFileSystem>;
  if (typeof module.File !== 'function') {
    throw new Error('Das Dateisystemmodul ist nicht verfügbar.');
  }
  return module as AvatarFileSystem;
}

function isLocalImageUri(uri: string): boolean {
  const scheme = uri.split(':', 1)[0]?.toLowerCase();
  return scheme === 'file' || scheme === 'content';
}

function resizeActionForLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { resize: { width: number } } | { resize: { height: number } } | null {
  if (Math.max(width, height) <= maxLongEdge) return null;
  return width >= height ? { resize: { width: maxLongEdge } } : { resize: { height: maxLongEdge } };
}

function deleteTemporaryFile(fileSystem: AvatarFileSystem, uri: string, sourceUri: string): void {
  if (uri === sourceUri) return;
  try {
    new fileSystem.File(uri).delete();
  } catch (error: unknown) {
    debugError('[AvatarUpload] Temporäre Datei konnte nicht gelöscht werden', error);
  }
}

async function readLocalImageBytes(uri: string): Promise<ArrayBuffer> {
  debugLogEvent('profile.avatar-upload.read-start', { sourceScheme: uri.split(':', 1)[0] });
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error('Die ausgewählte Bilddatei ist leer.');
  }
  debugLogEvent('profile.avatar-upload.read-complete', { byteLength: bytes.byteLength });
  return bytes;
}

async function normalizeAvatarBytes(sourceUri: string): Promise<ArrayBuffer> {
  const imageManipulator = loadImageManipulator();
  const fileSystem = loadFileSystem();
  let sourceDimensions: { width: number; height: number } | null = null;

  for (const [attempt, quality] of AVATAR_QUALITY_STEPS.entries()) {
    const targetLongEdge =
      attempt === 0 ? null : Math.max(640, AVATAR_MAX_LONG_EDGE - attempt * 128);
    const action =
      sourceDimensions && targetLongEdge
        ? resizeActionForLongEdge(sourceDimensions.width, sourceDimensions.height, targetLongEdge)
        : null;
    const result = await imageManipulator.manipulateAsync(sourceUri, action ? [action] : [], {
      base64: false,
      compress: quality,
      format: 'jpeg',
    });
    sourceDimensions ??= { width: result.width, height: result.height };

    if (!isLocalImageUri(result.uri)) {
      throw new Error('Die Bildbearbeitung muss eine lokale JPEG-Datei liefern.');
    }

    try {
      const bytes = await readLocalImageBytes(result.uri);
      if (bytes.byteLength <= AVATAR_MAX_BYTES) {
        debugLogEvent('profile.avatar-upload.normalized', {
          attempt: attempt + 1,
          byteLength: bytes.byteLength,
          width: result.width,
          height: result.height,
        });
        return bytes;
      }
      debugLogEvent('profile.avatar-upload.retry-compression', {
        attempt: attempt + 1,
        byteLength: bytes.byteLength,
      });
    } finally {
      deleteTemporaryFile(fileSystem, result.uri, sourceUri);
    }
  }

  throw new Error(`Profilbilder dürfen maximal ${AVATAR_MAX_BYTES} Bytes groß sein.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRetryableTransportError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : isRecord(error) ? error.message : undefined;
  if (typeof message !== 'string') return false;

  return /fetch failed|network request failed|network error|cannot parse response|parsen der antwort|timed out|timeout|connection reset/iu.test(
    message,
  );
}

async function uploadWithRecovery(upload: () => Promise<{ error: unknown | null }>): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    debugLogEvent('profile.avatar-upload.storage-attempt', { attempt: attempt + 1 });
    try {
      const { error } = await upload();
      if (!error) return;
      if (!isRetryableTransportError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      debugLogEvent('profile.avatar-upload.storage-retry', { attempt: attempt + 1 });
    } catch (error: unknown) {
      if (!isRetryableTransportError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      debugLogEvent('profile.avatar-upload.storage-retry', { attempt: attempt + 1 });
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

/** Öffnet die native Foto-Auswahl mit quadratischem Zuschnitt (1:1). */
export async function pickAvatarImage(): Promise<string | null> {
  debugLogEvent('profile.avatar-picker.start');
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    debugLogEvent('profile.avatar-picker.permission', {
      granted: permission.granted,
      status: permission.status,
    });
    if (!permission.granted) {
      throw new Error('Der Zugriff auf deine Fotos wurde verweigert.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    debugLogEvent('profile.avatar-picker.result', {
      canceled: result.canceled,
      assetCount: result.assets?.length ?? 0,
    });

    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  } catch (error: unknown) {
    debugError('[AvatarPicker] Bildauswahl fehlgeschlagen', error);
    throw error;
  }
}

export async function uploadAvatarImage(localUri: string): Promise<string> {
  debugLogEvent('profile.avatar-upload.start', {
    sourceScheme: localUri.split(':', 1)[0],
  });
  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError ?? new Error('Not authenticated');
    }
    debugLogEvent('profile.avatar-upload.authenticated');

    const bytes = await normalizeAvatarBytes(localUri);
    const path = `${user.id}/avatar.jpg`;
    const storage = supabase.storage.from(AVATAR_BUCKET);

    await uploadWithRecovery(() =>
      storage.upload(path, bytes, { contentType: 'image/jpeg', upsert: true }),
    );
    debugLogEvent('profile.avatar-upload.complete', { byteLength: bytes.byteLength });

    return `${env.supabaseUrl}/storage/v1/object/authenticated/${AVATAR_BUCKET}/${path}?v=${Date.now()}`;
  } catch (error: unknown) {
    debugError('[AvatarUpload] Upload fehlgeschlagen', error);
    throw new Error('Profilbild konnte nicht hochgeladen werden. Bitte versuche es erneut.', {
      cause: error,
    });
  }
}
