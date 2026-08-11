import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { MacroBar } from '@/components/macro-bar';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { getExpiryInfo } from '@/features/fridge/expiry';
import { useExpiryNotifications } from '@/features/fridge/use-expiry-notifications';
import { type LocalFridgeItem, useFridgeItems } from '@/features/fridge/use-fridge-items';
import { useUpdateFridgeItemQuantityMutation } from '@/features/fridge/use-fridge-mutations';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useAddShoppingItem } from '@/features/shopping-list/use-shopping-list-mutations';
import { useTheme } from '@/hooks/use-theme';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DashboardScreen() {
  const theme = useTheme();
  const now = new Date();
  const heute = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: fridgeItems = [], isLoading } = useFridgeItems(householdId);
  const updateQuantityMutation = useUpdateFridgeItemQuantityMutation();
  const addShoppingItemMutation = useAddShoppingItem();

  // Hintergrund-Benachrichtigungen aktivieren/synchronisieren
  useExpiryNotifications(householdId);

  const { session } = useSession();
  const userId = session?.user.id;
  const todayIso = toIsoDate(now);
  const { data: currentGoal } = useCurrentGoal(userId);
  const { data: todayEntries = [] } = useFoodEntries(userId, todayIso);
  const totals = calculateDailyTotals(
    todayEntries.map((e) => ({
      kcal: e.kcal,
      proteinG: e.protein_g,
      carbsG: e.carbs_g,
      fatG: e.fat_g,
    })),
  );
  const aufgenommen = totals.kcal;
  const ziel = currentGoal?.daily_kcal ?? 0;

  // Filtere ablaufende / abgelaufene Produkte (in <= 3 Tagen oder bereits abgelaufen)
  const expiringItems = fridgeItems
    .filter((item) => {
      if (!item.expiry_date) return false;
      const info = getExpiryInfo(item.expiry_date, now);
      return (
        info.bucket === 'expired' ||
        info.bucket === 'critical' ||
        (info.daysLeft !== null && info.daysLeft <= 3)
      );
    })
    .sort((a, b) => {
      const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
      const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      return dateA - dateB;
    });

  async function handleConsume(item: LocalFridgeItem) {
    if (!householdId) return;
    try {
      await updateQuantityMutation.mutateAsync({
        id: item.id,
        household_id: householdId,
        delta: -1,
      });
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Verbrauchen');
    }
  }

  async function handleAddToShoppingList(item: LocalFridgeItem) {
    if (!householdId) return;
    try {
      await addShoppingItemMutation.mutateAsync({
        household_id: householdId,
        name: item.name,
        quantity: 1,
        unit: item.unit,
      });
      Alert.alert('Einkaufsliste', `"${item.name}" wurde auf die Einkaufsliste gesetzt.`);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    }
  }

  return (
    <Screen title="Übersicht" subtitle={heute}>
      <Card>
        <ProgressRing value={aufgenommen} target={ziel} label="Kalorien" />
        {ziel === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Noch kein Kalorienziel gesetzt. Lege es unter Einstellungen an, damit hier ein
            Fortschritt erscheint.
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Makronährstoffe">
        <View style={styles.macros}>
          <MacroBar label="Eiweiß" value={totals.proteinG} target={currentGoal?.protein_g ?? 0} />
          <MacroBar
            label="Kohlenhydrate"
            value={totals.carbsG}
            target={currentGoal?.carbs_g ?? 0}
          />
          <MacroBar label="Fett" value={totals.fatG} target={currentGoal?.fat_g ?? 0} />
        </View>
      </Card>

      {/* Kein leerer Card-Rumpf mehr, sobald geladen und nichts ablaeuft. */}
      {isLoading || expiringItems.length > 0 ? (
        <Card title="Läuft bald ab">
          {isLoading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Lade Vorräte...
            </ThemedText>
          ) : (
            <View style={styles.expiringList}>
              {expiringItems.map((item) => {
                const info = getExpiryInfo(item.expiry_date, now);
                return (
                  <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.itemInfo}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.quantity} {item.unit} · {item.location_name ?? 'Kühlschrank'}
                      </ThemedText>
                      <View
                        style={[styles.badge, { backgroundColor: `${theme[info.themeColor]}22` }]}>
                        <ThemedText
                          type="small"
                          style={{ color: theme[info.themeColor], fontWeight: 'bold' }}>
                          {info.label}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.actionButtons}>
                      <Pressable
                        onPress={() => handleConsume(item)}
                        style={[styles.btn, { backgroundColor: `${theme.accent}18` }]}>
                        <ThemedText type="small" style={{ color: theme.accent, fontSize: 12 }}>
                          ✓ Verbraucht
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        onPress={() => handleAddToShoppingList(item)}
                        style={[styles.btn, { backgroundColor: `${theme.textSecondary}18` }]}>
                        <ThemedText type="small" style={{ fontSize: 12 }}>
                          🛒 Einkaufen
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  macros: {
    gap: Spacing.three,
  },
  expiringList: {
    gap: Spacing.two,
  },
  itemRow: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  actionButtons: {
    gap: 6,
  },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
});
