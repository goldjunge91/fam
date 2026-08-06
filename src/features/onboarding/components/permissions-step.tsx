import { Button, Column, Host, Row, Spacer, Text } from '@expo/ui';
import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';

interface PermissionsStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const theme = useTheme();
  const { updatePermissionsData } = useOnboarding();

  const handlePermissions = async () => {
    updatePermissionsData({
      notificationsRequested: true,
      cameraRequested: true,
    });
    onNext();
  };

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text style={[styles.heading, { color: theme.text }]}>Erlaubnisse & Funktionen</Text>
        <Text style={[styles.subheading, { color: theme.textSecondary }]}>
          Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
        </Text>

        <Spacer height={Spacing.three} />

        <Column style={styles.permissionList}>
          <Column
            style={[
              styles.permCard,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <Text style={[styles.permTitle, { color: theme.text }]}>🔔 Benachrichtigungen</Text>
            <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
              Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
            </Text>
          </Column>

          <Spacer height={Spacing.two} />

          <Column
            style={[
              styles.permCard,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <Text style={[styles.permTitle, { color: theme.text }]}>📷 Kamera-Zugriff</Text>
            <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
              Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
            </Text>
          </Column>
        </Column>

        <Spacer height={Spacing.four} />

        <Row style={styles.buttonRow}>
          <Button onPress={handlePermissions}>Berechtigungen erlauben</Button>
          <Button onPress={onSkip}>Jetzt nicht</Button>
        </Row>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 14,
    marginTop: Spacing.one,
  },
  permissionList: {
    width: '100%',
  },
  permCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
