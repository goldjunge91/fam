import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { IconButton, Press, Txt } from '@/constants/ui';

const styles = StyleSheet.create((theme) => ({
  content: {
    flex: 1,
    gap: theme.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    gap: theme.space.xs,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
  scanner: {
    flex: 1,
    minHeight: 420,
    marginHorizontal: theme.space.lg,
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    backgroundColor: theme.backgroundSoft,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerHint: {
    position: 'absolute',
    top: theme.space.lg,
    left: theme.space.lg,
    right: theme.space.lg,
    alignItems: 'center',
  },
  receipt: {
    width: '58%',
    minHeight: 230,
    padding: theme.space.lg,
    gap: theme.space.sm,
    transform: [{ rotate: '-5deg' }],
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  receiptRule: {
    height: 1,
    width: '100%',
    backgroundColor: theme.border,
  },
  scanLine: {
    position: 'absolute',
    left: theme.space.lg,
    right: theme.space.lg,
    height: 2,
    backgroundColor: theme.danger,
    opacity: 0.8,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: theme.warning,
  },
  cornerTopLeft: {
    top: theme.space.lg,
    left: theme.space.lg,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: theme.space.lg,
    right: theme.space.lg,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: theme.space.lg,
    left: theme.space.lg,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: theme.space.lg,
    right: theme.space.lg,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space.md,
    paddingTop: theme.space.md,
    paddingRight: theme.space.xl,
    paddingBottom: theme.space.xxl,
  },
  cameraButton: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.danger,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
}));

export type ReceiptScannerDummyScreenProps = {
  onBack?: () => void;
  onHelp?: () => void;
  onCapture?: () => void;
  onPickFromGallery?: () => void;
};

/** Visual handoff for the receipt scanner before the native camera is wired in. */
export function ReceiptScannerDummyScreen({
  onBack,
  onHelp,
  onCapture,
  onPickFromGallery,
}: ReceiptScannerDummyScreenProps) {
  const { colors } = useTheme();

  return (
    <Screen padded={false} applyBottomPadding={false} scroll={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            onPress={onBack}
            accessibilityLabel="Zurück"
            bg="transparent"
          />
          <IconButton
            icon="help-circle"
            onPress={onHelp}
            accessibilityLabel="Hilfe"
            bg="transparent"
          />
        </View>

        <View style={styles.titleBlock}>
          <Txt variant="display">Beleg scannen</Txt>
        </View>

        <View style={styles.scanner} accessibilityLabel="Vorschau des späteren Live-Kamera-Feeds">
          <View style={styles.scannerHint}>
            <Txt variant="caption" tone="secondary">
              Kamera-Vorschau
            </Txt>
          </View>
          <View style={styles.receipt}>
            <Txt variant="label">MARKT</Txt>
            <Txt variant="caption" tone="secondary">
              Äpfel 2,49
            </Txt>
            <Txt variant="caption" tone="secondary">
              Vollkornbrot 2,99
            </Txt>
            <Txt variant="caption" tone="secondary">
              Joghurt 2,39
            </Txt>
            <View style={styles.receiptRule} />
            <Txt variant="subheading">16,53 €</Txt>
          </View>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <View style={styles.scanLine} />
        </View>

        <View style={styles.footer}>
          <Press
            onPress={onCapture}
            accessibilityRole="button"
            accessibilityLabel="Beleg aufnehmen"
            style={styles.cameraButton}>
            <Feather name="camera" size={28} color={colors.onDanger} />
          </Press>
          <Press
            onPress={onPickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Beleg aus Galerie auswählen"
            style={styles.galleryButton}>
            <Feather name="image" size={22} color={colors.text} />
          </Press>
        </View>
      </View>
    </Screen>
  );
}
