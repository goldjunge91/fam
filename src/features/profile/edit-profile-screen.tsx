import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { updatePassword, updateProfile, useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { pickAvatarImage, uploadAvatarImage } from '@/features/profile/avatar-uploader';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/lib/initials';
import { getSupabase } from '@/lib/supabase';

/**
 * Profil- und Account-Einstellungen:
 * Verwaltet Profilbild (Upload/Löschen), Name, E-Mail-Adresse und Passwort.
 */
export function EditProfileScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const currentEmail = session?.user.email ?? '';
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    if (profile?.avatar_url !== undefined) {
      setAvatarUrl(profile.avatar_url);
    }
    if (currentEmail) {
      setEmail(currentEmail);
    }
  }, [profile, currentEmail]);

  async function handlePickImage() {
    if (!userId || uploadingImage) return;
    try {
      const localUri = await pickAvatarImage();
      if (!localUri) return;

      setUploadingImage(true);
      const remoteUrl = await uploadAvatarImage(userId, localUri);
      setAvatarUrl(remoteUrl);

      // Direkt im Profil persistieren
      await updateProfile(userId, { avatarUrl: remoteUrl });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Hochladen des Profilbilds.';
      Alert.alert('Fehler', msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteImage() {
    if (!userId || uploadingImage) return;
    setAvatarUrl(null);
    try {
      await updateProfile(userId, { avatarUrl: null });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch {
      // Ignorieren
    }
  }

  async function handleSubmit() {
    if (loading || !userId) return;
    setFormError(null);

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = newPassword.trim();

    if (trimmedPass && trimmedPass.length < 6) {
      setFormError('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (trimmedPass && trimmedPass !== confirmPassword.trim()) {
      setFormError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);

    try {
      if (trimmedName && trimmedName !== profile?.display_name) {
        const { error: profileErr } = await updateProfile(userId, {
          displayName: trimmedName,
          avatarUrl,
        });
        if (profileErr) throw profileErr;
      }

      if (trimmedEmail && trimmedEmail !== currentEmail) {
        const { error: emailErr } = await getSupabase().auth.updateUser({
          email: trimmedEmail,
        });
        if (emailErr) throw emailErr;
      }

      if (trimmedPass) {
        const { error: passErr } = await updatePassword(trimmedPass);
        if (passErr) throw passErr;
      }

      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });

      Alert.alert('Erfolg', 'Deine Profil- & Account-Daten wurden erfolgreich aktualisiert.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Speichern der Account-Daten.';
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  }

  const initials = getInitials(displayName || 'Ohne Namen');

  return (
    <Screen
      title="Profil & Account"
      back={{ label: 'Mein Profil', href: '/profile' }}
      backStyle="icon">
      {/* Profilbild Karte */}
      <Card title="Profilbild">
        <View className="flex-row items-center gap-four">
          <View
            style={{ backgroundColor: theme.accent }}
            className="w-20 h-20 rounded-full overflow-hidden items-center justify-center border-2 border-border">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-full h-full" contentFit="cover" />
            ) : (
              <ThemedText type="title" themeColor="onAccent" className="text-2xl font-bold">
                {initials}
              </ThemedText>
            )}
          </View>

          <View className="flex-1 gap-two">
            <Button
              label={
                uploadingImage ? 'Wird geladen...' : avatarUrl ? 'Bild ändern' : 'Bild auswählen'
              }
              variant="secondary"
              onPress={handlePickImage}
              loading={uploadingImage}
            />
            {avatarUrl ? (
              <Pressable onPress={handleDeleteImage} hitSlop={8} className="py-one items-center">
                <ThemedText type="caption" themeColor="danger">
                  Bild entfernen
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>

      <Card title="Persönliche Angaben">
        <View className="gap-three">
          <TextField
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            placeholder="Wie sollen dich andere sehen?"
          />

          <TextField
            label="E-Mail-Adresse"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="deine.email@beispiel.de"
          />
        </View>
      </Card>

      <Card title="Passwort ändern">
        <ThemedText type="caption" themeColor="textSecondary" className="mb-two">
          Lass diese Felder leer, wenn du dein aktuelles Passwort behalten möchtest.
        </ThemedText>
        <View className="gap-three">
          <TextField
            label="Neues Passwort"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Mindestens 6 Zeichen"
            autoCapitalize="none"
          />
          <TextField
            label="Neues Passwort bestätigen"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Passwort wiederholen"
            autoCapitalize="none"
          />
        </View>
      </Card>

      {formError ? (
        <ThemedText type="small" themeColor="danger" className="px-one">
          {formError}
        </ThemedText>
      ) : null}

      <Button
        label="Änderungen speichern"
        onPress={handleSubmit}
        loading={loading || profileLoading}
      />
    </Screen>
  );
}
