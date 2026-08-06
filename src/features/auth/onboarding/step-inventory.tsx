import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function StepInventory() {
  return (
    <Card title="Schritt 2: Vorräte & Haltbarkeit">
      <ThemedText style={{ marginTop: Spacing.one, lineHeight: 22 }}>
        Nie wieder abgelaufene Lebensmittel verschwenden!
      </ThemedText>
      <View style={styles.featureList}>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>📍</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Vordefinierte Lagerorte</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Nutze Kühlschrank, Tiefkühltruhe & Abstellkammer oder erstelle eigene Orte.
            </ThemedText>
          </View>
        </View>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>⏰</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">MHD-Erinnerungen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Schnelle Datums-Knöpfe (+3 Tage, +7 Tage...) und automatische Ablauf-Indikatoren.
            </ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  featureList: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
});
