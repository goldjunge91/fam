import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { type FridgeItem, useFridgeItems, useStorageLocations } from '@/features/inventory/api';
import { useTheme } from '@/hooks/use-theme';

type Section = {
  title: string;
  data: FridgeItem[];
};

export function FridgeScreen() {
  const theme = useTheme();
  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];

  const { data: items, isLoading: itemsLoading } = useFridgeItems(currentHousehold?.id);
  const { data: locations, isLoading: locationsLoading } = useStorageLocations(
    currentHousehold?.id,
  );

  const isLoading = itemsLoading || locationsLoading;

  // Gruppiere Artikel nach Lagerort
  const sections: Section[] = [];
  if (locations && items) {
    for (const loc of locations) {
      const locItems = items.filter((i) => i.location_id === loc.id);
      if (locItems.length > 0) {
        sections.push({
          title: loc.name,
          data: locItems,
        });
      }
    }
    // Artikel ohne bekannten Lagerort
    const unassigned = items.filter((i) => !i.location_id);
    if (unassigned.length > 0) {
      sections.push({
        title: 'Ohne Zuweisung',
        data: unassigned,
      });
    }
  }

  if (isLoading) {
    return (
      <Screen title="Vorrat">
        <ThemedText>Lädt...</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen
      title="Vorrat"
      action={
        <View style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.one }}>
          <Button label="+" variant="primary" onPress={() => router.push('/add-item')} />
        </View>
      }>
      {items?.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ textAlign: 'center', marginBottom: Spacing.four }}>
            Dein Vorrat ist leer. Zeit, einkaufen zu gehen oder etwas hinzuzufügen!
          </ThemedText>
          <Button label="Artikel hinzufügen" onPress={() => router.push('/add-item')} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <ThemedText type="small" style={{ fontWeight: 'bold' }}>
                {title.toUpperCase()}
              </ThemedText>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              <View style={styles.itemMain}>
                <ThemedText style={{ fontWeight: 'bold' }}>{item.name}</ThemedText>
                {item.expiry_date && (
                  <ThemedText type="small" themeColor="textSecondary">
                    MHD: {item.expiry_date}
                  </ThemedText>
                )}
              </View>
              <View style={styles.itemTrailing}>
                <ThemedText>
                  {item.quantity} {item.unit}
                </ThemedText>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  sectionHeader: {
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemMain: {
    flex: 1,
  },
  itemTrailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
