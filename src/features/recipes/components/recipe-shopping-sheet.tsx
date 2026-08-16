import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { useAddShoppingItem } from '@/features/shopping-list/use-shopping-list-mutations';
import { useTheme } from '@/hooks/use-theme';
import { type RecipeShoppingNeed, useRecipeShoppingNeeds } from '../use-recipe-shopping-needs';
import type { RecipeDetail } from '../use-recipes';

type Props = {
  visible: boolean;
  detail: RecipeDetail;
  servings: number;
  onClose: () => void;
};

// Stabile Referenz statt Inline-`= []`: `data` ist `undefined`, solange die
// Query deaktiviert ist (kein Premium-Zugriff) — ein Inline-Default legt bei
// jedem Render ein neues Array an, das `useEffect`-Dependency unten wuerde
// das als Aenderung sehen und in eine Endlosschleife aus setState laufen.
const EMPTY_MISSING: RecipeShoppingNeed[] = [];

export function RecipeShoppingSheet({ visible, detail, servings, onClose }: Props) {
  const theme = useTheme();
  const { isPremium, refresh } = usePremium();
  const [accessGranted, setAccessGranted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unlocking, setUnlocking] = useState(false);
  const addShoppingItem = useAddShoppingItem();
  const hasAccess = isPremium || accessGranted;
  const { data: missing = EMPTY_MISSING, isLoading } = useRecipeShoppingNeeds(
    detail,
    servings,
    visible && hasAccess,
  );

  useEffect(() => {
    setSelected(new Set(missing.map((item) => item.productId)));
  }, [missing]);

  // async function unlockPremiumbuttonText: { color: '#FFFFFF',   fontWeight: 700 }fNeeded();
  async function unlockPremium() {
    setUnlocking(true);
    try {
      const outcome = await presentPaywallIfNeeded();
      if (outcome === 'purchased' || outcome === 'restored') {
        setAccessGranted(true);
        await refresh();
      } else if (outcome === 'unavailable') {
        Alert.alert(
          'Premium nicht verfügbar',
          'Die Premium-Paywall ist auf diesem Gerät nicht konfiguriert.',
        );
      }
    } finally {
      setUnlocking(false);
    }
  }

  function toggle(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function addSelected() {
    const selectedItems = missing.filter((item) => selected.has(item.productId));
    try {
      for (const item of selectedItems) {
        await addShoppingItem.mutateAsync({
          household_id: detail.recipe.household_id,
          product_id: item.productId,
          name: item.name,
          quantity: item.missingGrams,
          unit: 'g',
          store_id: item.preferredStoreId,
          recipe_names: [detail.recipe.title],
        });
      }
      onClose();
      Alert.alert(
        'Einkaufsliste aktualisiert',
        `${selectedItems.length} ${selectedItems.length === 1 ? 'Zutat wurde' : 'Zutaten wurden'} ergänzt.`,
      );
    } catch (error) {
      Alert.alert(
        'Übernahme fehlgeschlagen',
        error instanceof Error ? error.message : 'Die Zutaten konnten nicht übernommen werden.',
      );
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {hasAccess ? 'Fehlende Zutaten' : 'Mit Premium einkaufen'}
            </ThemedText>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Schließen"
              style={[styles.close, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText themeColor="accent" style={styles.closeText}>
                ×
              </ThemedText>
            </Pressable>
          </View>

          {!hasAccess ? (
            <>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                fam vergleicht die Rezeptzutaten mit deinem Vorrat und übernimmt nur Fehlendes in
                die Einkaufsliste.
              </ThemedText>
              <SheetButton label="Premium ansehen" loading={unlocking} onPress={unlockPremium} />
            </>
          ) : isLoading ? (
            <ActivityIndicator style={styles.loader} color={theme.accent} />
          ) : missing.length === 0 ? (
            <>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                Dein Vorrat deckt alle Zutaten für {servings}{' '}
                {servings === 1 ? 'Portion' : 'Portionen'} ab.
              </ThemedText>
              <SheetButton label="Schließen" onPress={onClose} />
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                Bereits vorhandene Mengen wurden abgezogen. Wähle aus, was auf die Einkaufsliste
                soll.
              </ThemedText>
              <View style={[styles.list, { backgroundColor: theme.backgroundSelected }]}>
                {missing.map((item, index) => {
                  const checked = selected.has(item.productId);
                  return (
                    <Pressable
                      key={item.productId}
                      onPress={() => toggle(item.productId)}
                      role="checkbox"
                      accessibilityState={{ checked }}
                      style={[
                        styles.row,
                        index < missing.length - 1 && {
                          borderBottomColor: theme.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: theme.accent,
                            backgroundColor: checked ? theme.accent : 'transparent',
                          },
                        ]}>
                        {checked ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
                      </View>
                      <ThemedText style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.amount}>
                        {item.missingGrams} g
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <SheetButton
                label={`${selected.size} ${selected.size === 1 ? 'Zutat' : 'Zutaten'} übernehmen`}
                loading={addShoppingItem.isPending}
                disabled={selected.size === 0}
                onPress={addSelected}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      role="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.accent },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <ThemedText type="captionCompact" style={styles.buttonText}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,31,39,0.30)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 19,
  },
  handle: { width: 38, height: 4, borderRadius: Radius.hairline, alignSelf: 'center' },
  header: {
    minHeight: 58,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, ...FontSize[18], lineHeight: 22, fontWeight: 700, letterSpacing: -0.4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { ...FontSize[18], lineHeight: 20, fontWeight: 500 },
  description: { ...FontSize[10], lineHeight: 15, fontWeight: 500 },
  loader: { height: 76 },
  list: {
    marginTop: 14,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    minHeight: 45,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#FFFFFF', ...FontSize[12], lineHeight: 14, fontWeight: 700 },
  itemName: { flex: 1, ...FontSize[10], lineHeight: 13, fontWeight: 600 },
  amount: { ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  button: {
    height: 48,
    marginTop: 14,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonText: { color: '#FFFFFF', ...FontSize[11], lineHeight: 14, fontWeight: 700 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
