import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITE_KEY = '@fam/pending_invite_token';

export async function savePendingInviteToken(token: string): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(PENDING_INVITE_KEY, token.trim());
    }
  } catch (err) {
    console.error('Fehler beim Speichern des Einladungs-Tokens:', err);
  }
}

export async function consumePendingInviteToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(PENDING_INVITE_KEY);
    if (token) {
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
      return token;
    }
    return null;
  } catch (err) {
    console.error('Fehler beim Lesen des Einladungs-Tokens:', err);
    return null;
  }
}

export async function peekPendingInviteToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}
