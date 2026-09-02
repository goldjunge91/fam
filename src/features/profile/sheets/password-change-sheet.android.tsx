import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';
import { useTheme } from '@/hooks/use-theme';

type PasswordChangeSheetProps = {
  visible: boolean;
  password: string;
  passwordConfirmation: string;
  passwordError?: string;
  passwordConfirmationError?: string;
  submissionError?: string | null;
  saving?: boolean;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onApply: () => void;
  onClose: () => void;
};

export function PasswordChangeSheet({
  visible,
  password,
  passwordConfirmation,
  passwordError,
  passwordConfirmationError,
  submissionError,
  saving = false,
  onPasswordChange,
  onPasswordConfirmationChange,
  onApply,
  onClose,
}: PasswordChangeSheetProps) {
  const theme = useTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPasswordVisible(false);
    setConfirmationVisible(false);
  }, [visible]);

  function visibilityButton(label: string, visibleValue: boolean, onPress: () => void) {
    return (
      <Pressable
        onPress={onPress}
        role="button"
        aria-label={`${label} ${visibleValue ? 'verbergen' : 'anzeigen'}`}
        aria-pressed={visibleValue}
        hitSlop={4}
        className="w-12 h-full items-center justify-center active:opacity-70">
        <SymbolView
          name={
            visibleValue
              ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              : { ios: 'eye', android: 'visibility', web: 'visibility' }
          }
          size={20}
          tintColor={theme.textSecondary}
        />
      </Pressable>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="profile-food-rules-sheet-backdrop">
        <ThemedView className="profile-password-sheet">
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <ThemedText type="bodyLarge">Passwort ändern</ThemedText>
              <ThemedText type="labelMuted">Speichere dein neues Passwort direkt hier.</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Passwort ändern schließen"
              className="modal-close-btn">
              <ThemedText aria-hidden>✕</ThemedText>
            </Pressable>
          </View>

          <View className="gap-three">
            <TextField
              label="Neues Passwort"
              value={password}
              onChangeText={onPasswordChange}
              error={passwordError}
              secureTextEntry={!passwordVisible}
              trailing={visibilityButton('Neues Passwort', passwordVisible, () =>
                setPasswordVisible((current) => !current),
              )}
              placeholder="Mindestens 8 Zeichen"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              className="text-body-small"
            />
            <TextField
              label="Neues Passwort bestätigen"
              value={passwordConfirmation}
              onChangeText={onPasswordConfirmationChange}
              error={passwordConfirmationError}
              secureTextEntry={!confirmationVisible}
              trailing={visibilityButton('Passwortbestätigung', confirmationVisible, () =>
                setConfirmationVisible((current) => !current),
              )}
              placeholder="Passwort wiederholen"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onApply}
              className="text-body-small"
            />
          </View>

          {submissionError ? (
            <ThemedText role="alert" type="small" themeColor="danger">
              {submissionError}
            </ThemedText>
          ) : null}

          <Button label="Passwort speichern" onPress={onApply} loading={saving} />
        </ThemedView>
      </View>
    </Modal>
  );
}
