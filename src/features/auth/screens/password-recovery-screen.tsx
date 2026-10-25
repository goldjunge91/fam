import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, TextField, Txt } from '@/constants/ui';
import { RecoveryPasswordForm } from '@/features/auth/components/recovery-password-form';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { usePasswordRecoveryCancellation } from '@/features/auth/hooks/use-password-recovery-cancellation';
import { usePasswordRecoveryStore } from '@/features/auth/recovery-store';
import {
  emailSchema,
  type PasswordRecoveryVerificationInput,
  passwordRecoveryVerificationSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function PasswordRecoveryScreen() {
  const { t } = useTranslation();
  const { token_hash: tokenHashParam, type: linkTypeParam } = useLocalSearchParams<{
    token_hash?: string | string[];
    type?: string | string[];
  }>();
  const phase = usePasswordRecoveryStore((state) => state.phase);
  const emailFromStore = usePasswordRecoveryStore((state) => state.email);
  const codeFromStore = usePasswordRecoveryStore((state) => state.code);
  const cooldownUntil = usePasswordRecoveryStore((state) => state.cooldownUntil);
  const recoveryLinkFailed = usePasswordRecoveryStore((state) => state.recoveryLinkFailed);
  const operation = usePasswordRecoveryStore((state) => state.operation);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const { cancel, isSaving } = usePasswordRecoveryCancellation();
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordRecoveryVerificationInput>({
    resolver: zodResolver(passwordRecoveryVerificationSchema),
    defaultValues: { email: emailFromStore, code: codeFromStore },
  });
  useRozeniteRHFDevTools({ control, id: 'password-recovery' });
  const email = watch('email');
  const code = watch('code');
  const secondsLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (tokenHashParam === undefined) return;

    router.setParams({ token_hash: undefined, type: undefined });
    if (
      typeof tokenHashParam !== 'string' ||
      tokenHashParam.trim() === '' ||
      linkTypeParam !== 'recovery'
    ) {
      usePasswordRecoveryStore.getState().markRecoveryLinkFailed();
      return;
    }

    void usePasswordRecoveryStore.getState().openRecoveryTokenHash(tokenHashParam);
  }, [linkTypeParam, tokenHashParam]);

  useEffect(() => {
    if (!cooldownUntil || secondsLeft <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil, secondsLeft]);

  async function requestCode() {
    setRequestError(null);
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setRequestError(
        translateAuthValidationMessage(parsedEmail.error.issues[0]?.message, t) ??
          t('auth.validation.emailInvalid'),
      );
      return;
    }

    const result = await usePasswordRecoveryStore.getState().requestCode(parsedEmail.data);
    if (result.status === 'error') {
      setRequestError(authErrorMessage(result.error, t) ?? t('auth.errors.sendFailed'));
    } else if (result.status === 'ok') {
      setValue('code', '', { shouldValidate: false });
      setCodeError(null);
      setNow(Date.now());
    }
  }

  async function verifyCode(values: PasswordRecoveryVerificationInput) {
    setCodeError(null);
    const store = usePasswordRecoveryStore.getState();
    store.setEmail(values.email);
    store.setCode(values.code);
    const result = await store.verifyCode();
    if (result.status === 'error') {
      setCodeError(authErrorMessage(result.error, t) ?? t('auth.errors.codeCheckFailed'));
    } else if (result.status === 'missing-session') {
      setCodeError(t('auth.errors.codeAcceptedNoSession'));
    }
  }

  async function changeEmail() {
    const changed = await usePasswordRecoveryStore.getState().changeEmail();
    if (!changed) return;
    usePasswordRecoveryStore.getState().setEmail('');
    setValue('email', '', { shouldValidate: false });
    setValue('code', '', { shouldValidate: false });
    setRequestError(null);
    setCodeError(null);
  }

  if (phase === 'verified' || phase === 'updated' || phase === 'sign-in-required') {
    return <RecoveryPasswordForm onCancel={() => void cancel()} />;
  }

  if (phase === 'link-verifying') {
    return (
      <Screen title={t('auth.passwordReset.title')}>
        <ContentCard>
          <Txt variant="body">{t('auth.passwordReset.linkChecking')}</Txt>
        </ContentCard>
        <Button
          title={t('auth.passwordReset.cancel')}
          variant="secondary"
          onPress={() => void cancel()}
          disabled={isSaving}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('auth.passwordReset.codeTitle')}
      subtitle={t('auth.passwordReset.codeSubtitle')}>
      <ContentCard>
        <View style={styles.form}>
          <TextField
            testID="password-recovery-email"
            label={t('auth.fields.email')}
            value={email}
            onChangeText={(value) => {
              const previousEmail = usePasswordRecoveryStore.getState().email;
              usePasswordRecoveryStore.getState().setEmail(value);
              setValue('email', value, { shouldValidate: true });
              if (previousEmail !== value) setValue('code', '', { shouldValidate: false });
            }}
            error={translateAuthValidationMessage(errors.email?.message, t)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            editable={!operation}
          />
          <TextField
            testID="password-recovery-code"
            label={t('auth.fields.verificationCode')}
            value={code}
            onChangeText={(value) => {
              usePasswordRecoveryStore.getState().setCode(value);
              setValue('code', value.replace(/\D/g, '').slice(0, 6), {
                shouldValidate: true,
              });
              setCodeError(null);
            }}
            error={codeError ?? translateAuthValidationMessage(errors.code?.message, t)}
            placeholder={t('auth.verification.codePlaceholder')}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            editable={!operation}
            onSubmitEditing={() => void handleSubmit(verifyCode)()}
            returnKeyType="go"
          />

          {cooldownUntil ? (
            <Txt variant="body" tone="secondary">
              {t('auth.passwordReset.sentBody', { email: email.trim().toLowerCase() })}
            </Txt>
          ) : null}
          {requestError ? (
            <Txt variant="body" tone="danger">
              {requestError}
            </Txt>
          ) : null}

          <Button
            title={
              secondsLeft > 0
                ? t('auth.passwordReset.resendCooldown', { seconds: secondsLeft })
                : cooldownUntil
                  ? t('auth.passwordReset.resendCode')
                  : t('auth.passwordReset.requestCode')
            }
            onPress={() => void requestCode()}
            loading={operation === 'sending'}
            disabled={secondsLeft > 0 || Boolean(operation)}
          />
          <Button
            title={t('auth.passwordReset.verifyCode')}
            onPress={() => void handleSubmit(verifyCode)()}
            loading={operation === 'verifying' || isSubmitting}
            disabled={Boolean(operation) || code.length !== 6}
          />
        </View>
      </ContentCard>
      {cooldownUntil ? (
        <Button
          title={t('auth.passwordReset.changeEmail')}
          variant="secondary"
          onPress={() => void changeEmail()}
          disabled={Boolean(operation)}
        />
      ) : null}
      <Button
        title={t('auth.passwordReset.cancel')}
        variant="secondary"
        onPress={() => void cancel()}
        disabled={isSaving}
      />
      {recoveryLinkFailed ? (
        <Txt variant="body" tone="danger">
          {t('auth.passwordReset.linkInvalid')}
        </Txt>
      ) : null}
    </Screen>
  );
}
