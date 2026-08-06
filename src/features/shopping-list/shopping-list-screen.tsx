import { useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';
import { getSupabase } from '@/lib/supabase';

import { CompleteRunSheet, type TransferItem } from './complete-run-sheet';
import { useCompleteShoppingRun } from './use-complete-shopping-run';
import { type LocalShoppingItem, useShoppingList } from './use-shopping-list';
import {
  useAddShoppingItem,
  useDeleteShoppingItem,
  useToggleShoppingItem,
} from './use-shopping-list-mutations';

// ---------------------------------------------------------------------------
// Einzel-Artikel-Zeile
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: LocalShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}

function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  const theme = useTheme();
  const isChecked = item.checked_at !== null;

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onDelete}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessibilityLabel={item.name}
      accessibilityHint="Antippen zum Abhaken, lang drücken zum Löschen"
      style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          {
            borderColor: isChecked ? theme.accent : theme.border,
            backgroundColor: isChecked ? theme.accent : 'transparent',
          },
        ]}>
        {isChecked ? <ThemedText style={{ color: '#fff', fontSize: 12 }}>✓</ThemedText> : null}
      </View>

      <View style={styles.itemContent}>
        <ThemedText
          type="small"
          style={isChecked ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.quantity} {item.unit}
        </ThemedText>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Formular: Artikel hinzufügen
// ---------------------------------------------------------------------------

interface AddItemFormProps {
  householdId: string;
  onDismiss: () => void;
}

function AddItemForm({ householdId, onDismiss }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [nameError, setNameError] = useState<string | null>(null);

  const addItem = useAddShoppingItem();

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    await addItem.mutateAsync({
      household_id: householdId,
      name: trimmed,
      quantity: Number(quantity) || 1,
      unit,
    });

    setName('');
    setQuantity('1');
    onDismiss();
  }

  return (
    <Card title="Artikel hinzufügen">
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="z. B. Milch"
        autoFocus
        error={nameError ?? undefined}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Menge"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="1"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Einheit"
            value={unit}
            onChangeText={setUnit}
            placeholder="piece"
            autoCapitalize="none"
          />
        </View>
      </View>
      <View style={styles.row}>
        <Button label="Abbrechen" variant="secondary" onPress={onDismiss} />
        <Button label="Hinzufügen" onPress={handleAdd} loading={addItem.isPending} />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Haupt-Screen
// ---------------------------------------------------------------------------

/**
 * Gemeinsame Einkaufsliste (#85/#86).
 *
 * Zeigt Artikel nach Kategorie gruppiert. Antippen = abhaken.
 * Lang drücken = loeschen (mit Bestaetigung).
 * "Einkauf abschließen" = Transfer-Sheet oeffnen.
 *
 * Der Preisvergleich zwischen Ketten ist bewusst nicht Teil des ersten Wurfs:
 * REWE und EDEKA bieten keine oeffentliche API, und Scraping verstoesst gegen
 * ihre Nutzungsbedingungen. Geplant ist stattdessen ein PriceProvider-Interface
 * mit manueller Preiserfassung.
 */
export function ShoppingListScreen() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];
  const householdId = currentHousehold?.id;

  const { data: groups = [], isLoading } = useShoppingList(householdId);

  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const completeRun = useCompleteShoppingRun(householdId);

  const allItems = groups.flatMap((g) => g.items);
  const checkedItems = allItems.filter((i) => i.checked_at !== null);
  const hasCheckedItems = checkedItems.length > 0;

  async function handleToggle(item: LocalShoppingItem) {
    // userId aus Supabase-Session — fuer checked_by
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

  // Sections fuer SectionList — nur unkomplette zuerst, gecheckte ans Ende
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
      {/* Artikel-Formular */}
      {showAddForm ? (
        <AddItemForm householdId={householdId} onDismiss={() => setShowAddForm(false)} />
      ) : null}

      {/* Liste */}
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
            <ItemRow
              item={item}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDeletePress(item)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Einkauf abschließen — Floating-Button Stil, am Ende der Liste */}
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

      {/* Transfer-Sheet */}
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
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
