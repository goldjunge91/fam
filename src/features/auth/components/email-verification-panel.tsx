import { View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
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
          <ThemedText type="controlActionLarge">✉️</ThemedText>
        </View>
      </View>

      <View className="row-center">
        <View className="live-dot" />
        <ThemedText className="pending-title">Bestätigung ausstehend</ThemedText>
      </View>

      <View className="email-capsule">
        <ThemedText type="smallBold" themeColor="accent">
          {email}
        </ThemedText>
      </View>

      <ThemedText type="smallMuted" className="pending-description">
        Wir haben dir eine E-Mail geschickt. Klick den Link darin — egal auf welchem Gerät, die App
        merkt das von selbst und geht weiter. Oder gib den 6-stelligen Code aus der E-Mail hier ein.
      </ThemedText>

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
          label="Bestätigen"
          onPress={verification.confirmCode}
          loading={verification.confirming}
          disabled={verification.code.length !== 6}
        />
      </View>

      {verification.resendStatus ? (
        <ThemedText
          type={verification.resendFailed ? 'smallDanger' : 'smallMuted'}
          className="text-center">
          {verification.resendStatus}
        </ThemedText>
      ) : null}

      <View className="action-list">
        <Button
          label={
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
            label="Jetzt prüfen"
            variant="secondary"
            onPress={verification.checkConfirmation}
            loading={verification.recovering}
          />
        ) : null}

        {onChangeEmail ? (
          <Button
            label="Andere E-Mail-Adresse verwenden"
            variant="secondary"
            onPress={onChangeEmail}
          />
        ) : null}
      </View>
    </View>
  );
}
