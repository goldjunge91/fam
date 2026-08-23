import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategorySource } from '../classification/types';
import { colorForCategory, SHOPPING_CATEGORIES } from '../domain-logik/shopping-categories';
import { describeCategorySource } from './category-source-copy';

const SONSTIGES_LABEL = 'Sonstiges';

interface CategoryFieldProps {
  label?: string;
  categoryId: ShoppingCategoryId | null;
  source: CategorySource | null;
  /** Manuelle Auswahl einer Kategorie oder bewusst "Sonstiges" (`null`). */
  onSelectCategory: (categoryId: ShoppingCategoryId | null) => void;
  /** "Auf automatisch zurücksetzen" (#223 Abschnitt 9/11). */
  onReset: () => void;
}

/**
 * Kategoriefeld unter "Weitere Angaben" — die in #230 gewählte UI-Variante 1
 * (Kommentar auf dem Issue: WheelPickerField-Stil, neben Einheit/Preis).
 * Anders als `WheelPickerField` zeigt das geschlossene Feld zwei Zeilen
 * (Kategorie + Herkunft), deshalb ein eigenes, kleines Bauteil statt
 * Wiederverwendung — der native Wheel-Picker (`@expo/ui`) eignet sich zudem
 * eher für kontinuierliche Werte (Einheit) als für eine flache 14-Optionen-
 * Liste mit einer expliziten "Automatisch"-Aktion an erster Stelle.
 */
export function CategoryField({
  label = 'Kategorie',
  categoryId,
  source,
  onSelectCategory,
  onReset,
}: CategoryFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const categoryLabel =
    categoryId === null
      ? SONSTIGES_LABEL
      : (SHOPPING_CATEGORIES.find((c) => c.id === categoryId)?.label ?? SONSTIGES_LABEL);
  const dotColor = colorForCategory(categoryLabel === SONSTIGES_LABEL ? null : categoryLabel);
  const caption = describeCategorySource(source, categoryId);
  const isAutomatic = source !== 'user';

  function selectCategory(id: ShoppingCategoryId | null) {
    onSelectCategory(id);
    setIsOpen(false);
  }

  function selectAutomatic() {
    onReset();
    setIsOpen(false);
  }

  return (
    <View className="gap-one">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${categoryLabel}, ${caption}. Ändern`}
        className="flex-row items-center gap-two rounded-control border-hairline border-border bg-background-element px-three py-two active:opacity-70">
        {dotColor ? (
          <View className="w-[10px] h-[10px] rounded-pill" style={{ backgroundColor: dotColor }} />
        ) : null}
        <View className="flex-1 min-w-0">
          <ThemedText type="body" numberOfLines={1}>
            {categoryLabel}
          </ThemedText>
          <ThemedText type="captionMuted" numberOfLines={1}>
            {caption}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">⌄</ThemedText>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            <ThemedText type="subtitle">{label}</ThemedText>
            <ScrollView style={{ maxHeight: 420 }} className="gap-[2px]">
              <CategoryOptionRow
                label="Automatisch"
                checked={isAutomatic}
                onPress={selectAutomatic}
              />
              {SHOPPING_CATEGORIES.map((category) => (
                <CategoryOptionRow
                  key={category.id}
                  label={category.label}
                  color={category.color}
                  checked={source === 'user' && categoryId === category.id}
                  onPress={() => selectCategory(category.id as ShoppingCategoryId)}
                />
              ))}
              <CategoryOptionRow
                label={SONSTIGES_LABEL}
                checked={source === 'user' && categoryId === null}
                onPress={() => selectCategory(null)}
              />
            </ScrollView>
            <Button label="Schließen" variant="secondary" onPress={() => setIsOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CategoryOptionRow({
  label,
  color,
  checked,
  onPress,
}: {
  label: string;
  color?: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: checked }}
      className="flex-row items-center gap-two py-two px-one active:opacity-70">
      {color ? (
        <View className="w-[10px] h-[10px] rounded-pill" style={{ backgroundColor: color }} />
      ) : (
        <View className="w-[10px] h-[10px]" />
      )}
      <ThemedText type="body" className="flex-1">
        {label}
      </ThemedText>
      {checked ? <ThemedText themeColor="accent">✓</ThemedText> : null}
    </Pressable>
  );
}
