import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, CloseButton, Press, TextField, Txt } from '@/constants/ui';
import { profileSheetStyles } from '@/features/profile/sheets/profile-sheet-styles';

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
  const { colors } = useTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPasswordVisible(false);
    setConfirmationVisible(false);
  }, [visible]);

  function visibilityButton(label: string, visibleValue: boolean, onPress: () => void) {
    return (
      <Press
        onPress={onPress}
        haptic="none"
        role="button"
        aria-label={`${label} ${visibleValue ? 'verbergen' : 'anzeigen'}`}
        aria-pressed={visibleValue}
        hitSlop={4}
        style={profileSheetStyles.visibilityButton}>
        <SymbolView
          name={
            visibleValue
              ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              : { ios: 'eye', android: 'visibility', web: 'visibility' }
          }
          size={20}
          tintColor={colors.textSecondary}
        />
      </Press>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={profileSheetStyles.backdrop}>
        <View style={profileSheetStyles.passwordSheet}>
          <View style={profileSheetStyles.handle} />
          <View style={profileSheetStyles.header}>
            <View style={profileSheetStyles.headerCopy}>
              <Txt variant="title">Passwort ändern</Txt>
              <Txt variant="caption" tone="secondary">
                Speichere dein neues Passwort direkt hier.
              </Txt>
            </View>
            <CloseButton onPress={onClose} accessibilityLabel="Passwort ändern schließen" />
          </View>

          <View style={profileSheetStyles.passwordFields}>
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
            />
          </View>

          {submissionError ? (
            <Txt role="alert" variant="caption" tone="danger">
              {submissionError}
            </Txt>
          ) : null}

          <Button title="Passwort speichern" onPress={onApply} loading={saving} />
        </View>
      </View>
    </Modal>
  );
}
