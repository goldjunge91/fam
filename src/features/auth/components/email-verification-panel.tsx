import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, Row, Surface, TextField, Txt } from '@/constants/ui';
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification';

interface EmailVerificationPanelProps {
  email: string;
  onConfirmed: () => void;
  onChangeEmail?: () => void;
  password?: string;
}

const styles = StyleSheet.create((theme) => ({
  pendingCard: {
    alignItems: 'center',
    gap: theme.space.lg,
    padding: theme.space.xl + theme.space.xs,
  },
  heroContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.space.xs,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    opacity: 0.2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.famLarge,
  },
  pendingTitle: {
    // Preserve the existing verification heading's intentionally tall line box.
    fontSize: theme.font.sizes.lg,
    lineHeight: 44,
  },
  iconGlyph: {
    lineHeight: 24,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radius.xs,
    backgroundColor: theme.warning,
  },
  emailCapsule: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.md,
  },
  pendingDescription: {
    paddingHorizontal: theme.space.sm,
  },
  codeBlock: {
    width: '100%',
    gap: theme.space.sm,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: theme.font.sizes.xl,
    letterSpacing: 8,
  },
  actionList: {
    width: '100%',
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
}));

export function EmailVerificationPanel({
  email,
  onConfirmed,
  onChangeEmail,
  password,
}: EmailVerificationPanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const verification = useEmailVerification({ email, password, onConfirmed });

  return (
    <Card padded={false} elevation="none" style={styles.pendingCard}>
      <View style={styles.heroContainer}>
        <Surface tone="accent" style={styles.pulseRing} />
        <Card
          padded={false}
          elevation="sm"
          style={[styles.iconCircle, { backgroundColor: colors.accent, borderWidth: 0 }]}>
          <Txt variant="glyph" style={styles.iconGlyph}>
            ✉️
          </Txt>
        </Card>
      </View>

      <Row>
        <View style={styles.liveDot} />
        <Txt variant="heading" style={styles.pendingTitle}>
          {t('auth.verification.pendingTitle')}
        </Txt>
      </Row>

      <Surface tone="soft" style={styles.emailCapsule}>
        <Txt variant="body" tone="primary" weight="700">
          {email}
        </Txt>
      </Surface>

      <Txt variant="body" tone="secondary" center style={styles.pendingDescription}>
        {t('auth.verification.description')}
      </Txt>

      <View style={styles.codeBlock}>
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
          style={styles.codeInput}
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

      <View style={styles.actionList}>
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
    </Card>
  );
}
