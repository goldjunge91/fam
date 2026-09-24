import { zodResolver } from '@hookform/resolvers/zod';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { signIn } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import {
  type SignInInput,
  signInSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { debugLogEvent } from '@/lib/observability/debug-log';
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

interface SignInFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
  testIDPrefix?: string;
}

type SignInSubmitSource = 'button' | 'keyboard';

export function SignInForm({ onSuccess, submitLabel, testIDPrefix = 'sign-in' }: SignInFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'sign-in' });
  const email = watch('email');
  const password = watch('password');

  async function submit(values: SignInInput, source: SignInSubmitSource) {
    setFormError(null);
    debugLogEvent('auth.sign-in.submit.started', {
      source,
      identifierPresent: values.email.trim().length > 0,
      credentialPresent: values.password.length > 0,
    });
    const { error } = await signIn(values.email, values.password);

    if (error) {
      debugLogEvent('auth.sign-in.submit.failed', {
        source,
        errorCode: error.code ?? 'unknown',
        errorStatus: error.status ?? null,
      });
      setFormError(authErrorMessage(error, t));
      return;
    }

    debugLogEvent('auth.sign-in.submit.succeeded', { source });
    onSuccess?.();
  }

  function requestSubmit(source: SignInSubmitSource) {
    if (source === 'button') {
      debugLogEvent('auth.sign-in.button-clicked', {
        source,
        identifierPresent: email.trim().length > 0,
        credentialPresent: password.length > 0,
      });
    }

    void handleSubmit(
      (values) => submit(values, source),
      (validationErrors) => {
        debugLogEvent('auth.sign-in.validation.failed', {
          source,
          invalidFields: Object.keys(validationErrors),
        });
      },
    )();
  }

  function visibilityButton() {
    return (
      <Press
        onPress={() => setPasswordVisible((current) => !current)}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={
          passwordVisible ? t('auth.actions.hidePassword') : t('auth.actions.showPassword')
        }
        aria-pressed={passwordVisible}
        hitSlop={4}
        containerStyle={styles.visibilityButtonContainer}
        style={styles.visibilityButton}>
        <SymbolView
          name={
            passwordVisible
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
        autoComplete="current-password"
        textContentType="password"
        trailing={visibilityButton()}
        onSubmitEditing={() => requestSubmit('keyboard')}
        returnKeyType="go"
      />

      {formError ? (
        <Txt variant="body" tone="danger" weight="500">
          {formError}
        </Txt>
      ) : null}

      <Button
        title={submitLabel ?? t('auth.signIn.submit')}
        onPress={() => requestSubmit('button')}
        loading={isSubmitting}
      />
    </View>
  );
}
