import { Modal, Pressable, View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';

type PasswordChangeSheetProps = {
  visible: boolean;
  password: string;
  passwordConfirmation: string;
  passwordError?: string;
  passwordConfirmationError?: string;
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
  onPasswordChange,
  onPasswordConfirmationChange,
  onApply,
  onClose,
}: PasswordChangeSheetProps) {
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
              <ThemedText type="headingSmall">Passwort ändern</ThemedText>
              <ThemedText type="smallMuted">
                Das neue Passwort wird mit deinen Profiländerungen gespeichert.
              </ThemedText>
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
              secureTextEntry
              placeholder="Mindestens 8 Zeichen"
              autoCapitalize="none"
            />
            <TextField
              label="Neues Passwort bestätigen"
              value={passwordConfirmation}
              onChangeText={onPasswordConfirmationChange}
              error={passwordConfirmationError}
              secureTextEntry
              placeholder="Passwort wiederholen"
              autoCapitalize="none"
            />
          </View>

          <Button label="Passwort übernehmen" onPress={onApply} />
        </ThemedView>
      </View>
    </Modal>
  );
}
