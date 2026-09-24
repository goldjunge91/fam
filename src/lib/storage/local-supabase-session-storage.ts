import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ENCRYPTION_KEY_STORAGE_KEY = 'fam.supabase-auth.encryption-key.v1';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === 'ios'
    ? {
        // Auto-refresh stops while inactive, so iOS only needs this key while
        // unlocked. The device-only class also excludes migration via backup.
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    : {};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeUtf8(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

function decodeUtf8(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value));
}

/**
 * Supabase Auth storage with the session encrypted at rest.
 *
 * The AES-256-GCM key lives in SecureStore; the encrypted session lives in
 * AsyncStorage. SecureStore is intentionally used only for the small key,
 * while AsyncStorage holds the arbitrarily sized ciphertext.
 */
export class LocalSupabaseSessionStorage {
  private encryptionKeyPromise: Promise<AESEncryptionKey> | null = null;

  private async loadOrCreateEncryptionKey(): Promise<AESEncryptionKey> {
    const storedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
    if (storedKey) return AESEncryptionKey.import(storedKey, 'base64');

    const key = await AESEncryptionKey.generate(AESKeySize.AES256);
    await SecureStore.setItemAsync(
      ENCRYPTION_KEY_STORAGE_KEY,
      await key.encoded('base64'),
      SECURE_STORE_OPTIONS,
    );
    return key;
  }

  private async getEncryptionKey(): Promise<AESEncryptionKey> {
    if (!this.encryptionKeyPromise) {
      const loading = this.loadOrCreateEncryptionKey();
      this.encryptionKeyPromise = loading;
      try {
        return await loading;
      } catch (error) {
        if (this.encryptionKeyPromise === loading) this.encryptionKeyPromise = null;
        throw error;
      }
    }
    return this.encryptionKeyPromise;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (encrypted === null) return null;

    const storedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
    if (!storedKey) return null;

    try {
      const encryptionKey = await AESEncryptionKey.import(storedKey, 'base64');
      const sealedData = AESSealedData.fromCombined(encrypted);
      const plaintext = await aesDecryptAsync(sealedData, encryptionKey, { output: 'base64' });
      if (typeof plaintext !== 'string') {
        throw new Error('Die entschlüsselte Supabase-Session hat ein ungültiges Format.');
      }
      return decodeUtf8(plaintext);
    } catch (error) {
      throw new Error('Die gespeicherte Supabase-Session konnte nicht entschlüsselt werden.', {
        cause: error,
      });
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await this.getEncryptionKey();
    const sealedData = await aesEncryptAsync(encodeUtf8(value), encryptionKey);
    await AsyncStorage.setItem(key, await sealedData.combined('base64'));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
    this.encryptionKeyPromise = null;
  }
}
