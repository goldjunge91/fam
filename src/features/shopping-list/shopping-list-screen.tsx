import { useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useTheme } from '@/hooks/use-theme';
import { getSupabase } from '@/lib/supabase';
import { CompleteRunSheet, type TransferItem } from './complete-run-sheet';
import { AddItemForm } from './components/add-item-form';
import { ShoppingItemRow } from './components/shopping-item-row';
import { useCompleteShoppingRun } from './use-complete-shopping-run';
import { type LocalShoppingItem, useShoppingList } from './use-shopping-list';
import { useDeleteShoppingItem, useToggleShoppingItem } from './use-shopping-list-mutations';

/**
 * Gemeinsame Einkaufsliste (#85/#86).
 *
 * Zeigt Artikel nach Kategorie gruppiert. Antippen = abhaken.
 * Lang drücken = loeschen (mit Bestaetigung).
 * "Einkauf abschließen" = Transfer-Sheet oeffnen.
 */
export function ShoppingListScreen() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const theme = useTheme();

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: groups = [], isLoading } = useShoppingList(householdId);

  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const completeRun = useCompleteShoppingRun(householdId);

  const allItems = groups.flatMap((g) => g.items);
  const checkedItems = allItems.filter((i) => i.checked_at !== null);
  const hasCheckedItems = checkedItems.length > 0;

  async function handleToggle(item: LocalShoppingItem) {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();

    await toggleItem.mutateAsync({
      id: item.id,
      household_id: item.household_id,
      checked_at: item.checked_at ? null : new Date().toISOString(),
      checked_by: item.checked_at ? null : (user?.id ?? null),
    });
  }

  function handleDeletePress(item: LocalShoppingItem) {
    Alert.alert('Artikel löschen', `"${item.name}" aus der Liste entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deleteItem.mutate({ id: item.id, household_id: item.household_id }),
      },
    ]);
  }

  async function handleCompleteRun(transfers: TransferItem[]) {
    if (!householdId) return;
    const {
      data: { user },
    } = await getSupabase().auth.getUser();

    await completeRun.mutateAsync({
      householdId,
      userId: user?.id ?? '',
      checkedItems,
      transfers,
    });

    setSheetOpen(false);
  }

  const sections = groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({ title: g.category, data: g.items }));

  if (!householdId) {
    return (
      <Screen title="Einkauf" subtitle="Gemeinsame Liste">
        <Card>
          <EmptyState
            symbol="cart"
            title="Noch kein Haushalt"
            hint="Lege im Profil einen Haushalt an oder tritt einem bei."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Einkauf"
      subtitle={`Zuletzt · ${allItems.length} Artikel`}
      action={
        <Pressable
          onPress={() => setShowAddForm(!showAddForm)}
          accessibilityRole="button"
          accessibilityLabel="Artikel hinzufügen"
          style={styles.addHeaderButton}>
          <ThemedText type="smallBold" themeColor="accent">
            + Artikel
          </ThemedText>
        </Pressable>
      }>
      {showAddForm ? (
        <AddItemForm householdId={householdId} onDismiss={() => setShowAddForm(false)} />
      ) : null}

      {isLoading ? null : allItems.length === 0 ? (
        <Card>
          <EmptyState
            symbol="cart"
            title="Einkaufsliste ist leer"
            hint="Tippe auf '+ Artikel' um zu starten."
          />
        </Card>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderSectionHeader={({ section }) => (
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHeader}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item }) => (
            <ShoppingItemRow
              item={item}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDeletePress(item)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      {hasCheckedItems ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Einkauf abschließen, ${checkedItems.length} Artikel abgehakt`}
          style={({ pressed }) => [
            styles.completeButton,
            { backgroundColor: theme.danger, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText style={styles.completeButtonText}>
            🛒 Einkauf abschließen ({checkedItems.length})
          </ThemedText>
        </Pressable>
      ) : null}

      <CompleteRunSheet
        isOpen={sheetOpen}
        checkedItems={checkedItems}
        onConfirm={handleCompleteRun}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addHeaderButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completeButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
