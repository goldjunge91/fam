import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { updatePassword } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { useSession } from '@/features/auth/session-provider';
import { updateProfile, useProfile } from '@/features/profile/api';
import { pickAvatarImage, uploadAvatarImage } from '@/features/profile/avatar-uploader';
import { FoodRulesSummary } from '@/features/profile/components/food-rules-summary';
import {
  ALLERGY_PRESETS,
  EMPTY_PROFILE_FOOD_RULES,
  INTOLERANCE_PRESETS,
  type ProfileFoodRules,
} from '@/features/profile/domain/food-rules';
import {
  profileFoodRulesQueryKey,
  saveProfileFoodRules,
  useProfileFoodRules,
} from '@/features/profile/food-rules-api';
import { FoodRuleSelectionSheet } from '@/features/profile/sheets/food-rule-selection-sheet';
import { PasswordChangeSheet } from '@/features/profile/sheets/password-change-sheet';
import { useTheme } from '@/hooks/use-theme';
import { type ProfileAccountForm, profileAccountFormSchema } from '@/lib/db/zod/profile.zod';
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
  const { data: storedFoodRules, isLoading: foodRulesLoading } = useProfileFoodRules(userId);
  const queryClient = useQueryClient();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [passwordSheetVisible, setPasswordSheetVisible] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaveError, setPasswordSaveError] = useState<string | null>(null);
  const [foodRules, setFoodRules] = useState<ProfileFoodRules>(EMPTY_PROFILE_FOOD_RULES);
  const [activeFoodRule, setActiveFoodRule] = useState<keyof ProfileFoodRules | null>(null);
  const hydratedFoodRulesUserId = useRef<string | null>(null);
  const {
    setValue,
    watch,
    reset,
    trigger,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileAccountForm>({
    resolver: zodResolver(profileAccountFormSchema),
    defaultValues: { displayName: '', email: '', newPassword: '', passwordConfirmation: '' },
  });
  const displayName = watch('displayName');
  const email = watch('email');
  const newPassword = watch('newPassword');
  const confirmPassword = watch('passwordConfirmation');

  useEffect(() => {
    reset({
      displayName: profile?.display_name ?? '',
      email: currentEmail,
      newPassword: '',
      passwordConfirmation: '',
    });
    if (profile?.avatar_url !== undefined) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile, currentEmail, reset]);

  useEffect(() => {
    if (!userId) {
      hydratedFoodRulesUserId.current = null;
      setFoodRules(EMPTY_PROFILE_FOOD_RULES);
      setActiveFoodRule(null);
      return;
    }

    if (!storedFoodRules || hydratedFoodRulesUserId.current === userId) return;

    hydratedFoodRulesUserId.current = userId;
    setFoodRules(storedFoodRules);
    setActiveFoodRule(null);
  }, [storedFoodRules, userId]);

  async function handlePickImage() {
    if (!userId || uploadingImage) return;
    try {
      const localUri = await pickAvatarImage();
      if (!localUri) return;

      setUploadingImage(true);
      const remoteUrl = await uploadAvatarImage(userId, localUri);

      // Direkt im Profil persistieren
      const { error } = await updateProfile(userId, { avatarUrl: remoteUrl });
      if (error) throw new Error(error.message, { cause: error });

      setAvatarUrl(remoteUrl);
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
    setUploadingImage(true);
    try {
      const { error } = await updateProfile(userId, { avatarUrl: null });
      if (error) throw new Error(error.message, { cause: error });

      setAvatarUrl(null);
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Entfernen des Profilbilds.';
      Alert.alert('Fehler', msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit(values: ProfileAccountForm) {
    if (!userId) return;
    setFormError(null);

    try {
      if (values.displayName !== profile?.display_name) {
        const { error: profileErr } = await updateProfile(userId, {
          displayName: values.displayName,
          avatarUrl,
        });
        if (profileErr) throw profileErr;
      }

      if (values.email !== currentEmail) {
        const { error: emailErr } = await getSupabase().auth.updateUser({
          email: values.email,
        });
        if (emailErr) throw emailErr;
      }

      await saveProfileFoodRules(userId, foodRules);

      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await queryClient.invalidateQueries({ queryKey: profileFoodRulesQueryKey(userId) });

      Alert.alert('Erfolg', 'Deine Profil- & Account-Daten wurden erfolgreich aktualisiert.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Speichern der Account-Daten.';
      setFormError(msg);
    }
  }

  function closePasswordSheet() {
    setValue('newPassword', '');
    setValue('passwordConfirmation', '');
    clearErrors(['newPassword', 'passwordConfirmation']);
    setPasswordSaveError(null);
    setPasswordSheetVisible(false);
  }

  async function savePassword() {
    if (passwordSaving) return;
    setPasswordSaveError(null);

    if (!newPassword) {
      setError('newPassword', {
        type: 'manual',
        message: 'Das Passwort braucht mindestens 8 Zeichen.',
      });
      return;
    }

    const isValid = await trigger(['newPassword', 'passwordConfirmation']);
    if (!isValid) return;

    setPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordSaveError(authErrorMessage(error));
        return;
      }

      closePasswordSheet();
      Alert.alert('Passwort gespeichert', 'Dein neues Passwort ist jetzt aktiv.');
    } finally {
      setPasswordSaving(false);
    }
  }

  const initials = getInitials(displayName || 'Ohne Namen');

  return (
    <Screen
      title="Profil & Account"
      back={{ label: 'Mein Profil', href: '/profile' }}
      backStyle="icon">
      {/* Profilbild-Karte mit Upload- & Löschen-Optionen */}
      <Card title="Profilbild">
        <View className="flex-row items-center gap-four">
          <View
            style={{ backgroundColor: theme.accent }}
            className="w-20 h-20 rounded-full overflow-hidden items-center justify-center border-2 border-border">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                accessibilityLabel="Profilbild bearbeiten"
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
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

      {/* Persönliche Angaben (Name & E-Mail-Adresse) */}
      <Card title="Persönliche Angaben">
        <View className="gap-three">
          <TextField
            label="Name"
            value={displayName}
            onChangeText={(value) => setValue('displayName', value, { shouldValidate: true })}
            error={errors.displayName?.message}
            autoCapitalize="words"
            placeholder="Wie sollen dich andere sehen?"
          />

          <TextField
            label="E-Mail-Adresse"
            value={email}
            onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
            error={errors.email?.message}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="deine.email@beispiel.de"
          />
        </View>
        <Button
          label="Passwort ändern"
          variant="secondary"
          size="compact"
          className="mt-one"
          onPress={() => setPasswordSheetVisible(true)}
        />
      </Card>

      <View className="mt-two">
        <FoodRulesSummary rules={foodRules} onSelect={setActiveFoodRule} />
      </View>

      <PasswordChangeSheet
        visible={passwordSheetVisible}
        password={newPassword}
        passwordConfirmation={confirmPassword}
        passwordError={errors.newPassword?.message}
        passwordConfirmationError={errors.passwordConfirmation?.message}
        submissionError={passwordSaveError}
        saving={passwordSaving}
        onPasswordChange={(value) => setValue('newPassword', value, { shouldValidate: true })}
        onPasswordConfirmationChange={(value) =>
          setValue('passwordConfirmation', value, { shouldValidate: true })
        }
        onApply={() => void savePassword()}
        onClose={closePasswordSheet}
      />

      <FoodRuleSelectionSheet
        visible={activeFoodRule === 'allergies'}
        title="Allergien"
        inputLabel="Allergie suchen oder ergänzen"
        presets={ALLERGY_PRESETS}
        value={foodRules.allergies}
        onApply={(allergies) => setFoodRules((current) => ({ ...current, allergies }))}
        onClose={() => setActiveFoodRule(null)}
      />
      <FoodRuleSelectionSheet
        visible={activeFoodRule === 'intolerances'}
        title="Unverträglichkeiten"
        inputLabel="Unverträglichkeit suchen oder ergänzen"
        presets={INTOLERANCE_PRESETS}
        value={foodRules.intolerances}
        onApply={(intolerances) => setFoodRules((current) => ({ ...current, intolerances }))}
        onClose={() => setActiveFoodRule(null)}
      />
      <FoodRuleSelectionSheet
        visible={activeFoodRule === 'dislikedFoods'}
        title="Mag ich nicht"
        inputLabel="Lebensmittel ergänzen"
        presets={[]}
        value={foodRules.dislikedFoods}
        onApply={(selections) =>
          setFoodRules((current) => ({
            ...current,
            dislikedFoods: selections.filter((selection) => selection.source === 'custom'),
          }))
        }
        onClose={() => setActiveFoodRule(null)}
      />

      {/* Fehlermeldungs-Anzeige */}
      {formError ? (
        <ThemedText type="small" themeColor="danger" className="px-one">
          {formError}
        </ThemedText>
      ) : null}

      {/* Speichern-Button */}
      <Button
        label="Änderungen speichern"
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting || profileLoading || foodRulesLoading}
      />
    </Screen>
  );
}
