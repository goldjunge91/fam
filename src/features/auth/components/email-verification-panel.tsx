import { View } from 'react-native';

import { Button, TextField, Txt } from '@/constants/ui';
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification';

interface EmailVerificationPanelProps {
  email: string;
  onConfirmed: () => void;
  onChangeEmail?: () => void;
  password?: string;
}

export function EmailVerificationPanel({
  email,
  onConfirmed,
  onChangeEmail,
  password,
}: EmailVerificationPanelProps) {
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
          Bestätigung ausstehend
        </Txt>
      </View>

      <View className="email-capsule">
        <Txt variant="body" tone="primary" weight="700">
          {email}
        </Txt>
      </View>

      <Txt variant="body" tone="secondary" className="pending-description">
        Wir haben dir eine E-Mail geschickt. Klick den Link darin — egal auf welchem Gerät, die App
        merkt das von selbst und geht weiter. Oder gib den 6-stelligen Code aus der E-Mail hier ein.
      </Txt>

      <View className="code-block">
        <TextField
          testID="email-verification-code"
          label="Code aus der E-Mail"
          value={verification.code}
          onChangeText={verification.setCodeInput}
          error={verification.codeError ?? undefined}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={verification.confirmCode}
          className="code-input"
        />

        <Button
          title="Bestätigen"
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
              ? `Erneut senden (${verification.cooldown}s)`
              : 'Bestätigungs-E-Mail erneut senden'
          }
          variant="secondary"
          onPress={verification.resendEmail}
          loading={verification.resending}
          disabled={verification.cooldown > 0}
        />

        {password ? (
          <Button
            title="Jetzt prüfen"
            variant="secondary"
            onPress={verification.checkConfirmation}
            loading={verification.recovering}
          />
        ) : null}

        {onChangeEmail ? (
          <Button
            title="Andere E-Mail-Adresse verwenden"
            variant="secondary"
            onPress={onChangeEmail}
          />
        ) : null}
      </View>
    </View>
  );
}
