import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, TextField, Txt } from '@/constants/ui';
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification';

interface EmailVerificationPanelProps {
  email: string;
  onConfirmed: () => void;
  onChangeEmail?: () => void;
  password?: string;
}

// export function EmailVerificationPanel({
//   email,
//   onConfirmed,
//   onChangeEmail,
//   password,
// }: EmailVerificationPanelProps) {
export function EmailVerificationPanel(props: EmailVerificationPanelProps) {
  const { t } = useTranslation();
  const email = props.email;
  const onConfirmed = props.onConfirmed;
  const onChangeEmail = props.onChangeEmail;
  const password = props.password;
  // onConfirmed weitergereicht an useEmailVerification
  const verification = useEmailVerification({ email, password, onConfirmed });

  return (
    <View className="pending-card">
      <View className="hero-container">
        <View className="pulse-ring opacity-20" />
        <View className="icon-circle">
          <Txt variant="heading" style={{ fontSize: 22, lineHeight: 24 }}>
            ✉️
          </Txt>
        </View>
      </View>

      <View className="row-center">
        <View className="live-dot" />
        <Txt variant="heading" className="pending-title">
          {t('auth.verification.pendingTitle')}
        </Txt>
      </View>

      <View className="email-capsule">
        <Txt variant="body" tone="primary" weight="700">
          {email}
        </Txt>
      </View>

      <Txt variant="body" tone="secondary" className="pending-description">
        {t('auth.verification.description')}
      </Txt>

      <View className="code-block">
        <TextField
          testID="email-verification-code"
          label={t('auth.fields.verificationCode')}
          value={verification.code}
          onChangeText={verification.setCodeInput}
          error={verification.codeError ?? undefined}
          placeholder={t('auth.verification.codePlaceholder')}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={verification.confirmCode}
          className="code-input"
        />

        <Button
          title={t('auth.verification.confirm')}
          onPress={verification.confirmCode}
          loading={verification.confirming}
          disabled={verification.code.length !== 6}
        />
      </View>

      {verification.resendStatus ? (
        <Txt variant="body" tone={verification.resendFailed ? 'danger' : 'secondary'} center>
          {verification.resendStatus}
        </Txt>
      ) : null}

      <View className="action-list">
        <Button
          title={
            verification.cooldown > 0
              ? t('auth.verification.resendCooldown', { seconds: verification.cooldown })
              : t('auth.verification.resend')
          }
          variant="secondary"
          onPress={verification.resendEmail}
          loading={verification.resending}
          disabled={verification.cooldown > 0}
        />

        {password ? (
          <Button
            title={t('auth.verification.checkNow')}
            variant="secondary"
            onPress={verification.checkConfirmation}
            loading={verification.recovering}
          />
        ) : null}

        {onChangeEmail ? (
          <Button
            title={t('auth.verification.changeEmail')}
            variant="secondary"
            onPress={onChangeEmail}
          />
        ) : null}
      </View>
    </View>
  );
}
