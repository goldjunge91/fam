import { zodResolver } from '@hookform/resolvers/zod';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { signUp } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import {
  type SignUpInput,
  signUpSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  visibilityButtonContainer: {
    width: 48,
    height: '100%',
  },
  visibilityButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface PendingSignUp {
  email: string;
  password: string;
}

interface SignUpFormProps {
  onSuccess: () => void;
  onPendingVerification: (pendingSignUp: PendingSignUp) => void;
  submitLabel?: string;
  testIDPrefix?: string;
}

export function SignUpForm({
  onSuccess,
  onPendingVerification,
  submitLabel,
  testIDPrefix = 'sign-up',
}: SignUpFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordConfirmation: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'sign-up' });
  const email = watch('email');
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: SignUpInput) {
    setFormError(null);
    const { data, error } = await signUp(values.email, values.password);

    if (error) {
      setFormError(authErrorMessage(error, t));
      return;
    }

    if (!data.session) {
      onPendingVerification({ email: values.email, password: values.password });
      return;
    }

    onSuccess();
  }

  function visibilityButton(
    visibleValue: boolean,
    onPress: () => void,
    showLabel: string,
    hideLabel: string,
  ) {
    return (
      <Press
        onPress={onPress}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={visibleValue ? hideLabel : showLabel}
        aria-pressed={visibleValue}
        hitSlop={4}
        containerStyle={styles.visibilityButtonContainer}
        style={styles.visibilityButton}>
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
    <View style={styles.form}>
      <TextField
        testID={`${testIDPrefix}-email`}
        label={t('auth.fields.email')}
        value={email}
        onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.email?.message, t)}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        inputMode="email"
      />

      <TextField
        testID={`${testIDPrefix}-password`}
        label={t('auth.fields.password')}
        value={password}
        onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.password?.message, t)}
        secureTextEntry={!passwordVisible}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        trailing={visibilityButton(
          passwordVisible,
          () => setPasswordVisible((current) => !current),
          t('auth.actions.showPassword'),
          t('auth.actions.hidePassword'),
        )}
      />

      <TextField
        testID={`${testIDPrefix}-password-confirmation`}
        label={t('auth.fields.passwordConfirmation')}
        value={passwordConfirmation}
        onChangeText={(value) => setValue('passwordConfirmation', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.passwordConfirmation?.message, t)}
        secureTextEntry={!passwordConfirmationVisible}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        trailing={visibilityButton(
          passwordConfirmationVisible,
          () => setPasswordConfirmationVisible((current) => !current),
          t('auth.actions.showPasswordConfirmation'),
          t('auth.actions.hidePasswordConfirmation'),
        )}
        onSubmitEditing={() => void handleSubmit(submit)()}
        returnKeyType="go"
      />

      {formError ? (
        <Txt variant="body" tone="danger" weight="500">
          {formError}
        </Txt>
      ) : null}

      <Button
        title={submitLabel ?? t('auth.signUp.submit')}
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting}
      />
    </View>
  );
}
