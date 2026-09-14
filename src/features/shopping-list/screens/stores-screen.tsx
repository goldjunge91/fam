import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Switch, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Button, Divider, Press, Row, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../domain-logik/store-presets';
import {
  findStoreByName,
  useAddStoreMutation,
  useDeleteStoreMutation,
  useStores,
  useUpdateStoreMutation,
} from '../hooks/use-stores';
import {
  useSetShowPriceInMarketView,
  useShowPriceInMarketView,
} from '../preferences/display-settings';

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  form: {
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
  presetChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 6,
    borderRadius: theme.radius.xl,
    borderWidth: theme.borderWidth.base,
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.xs / 2,
  },
  swatchButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.lg,
  },
  storeList: {
    gap: theme.space.sm,
  },
  manageRow: {
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
  },
  storeColorDot: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.xs,
  },
}));

export function StoresScreen() {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();
  const { session } = useSession();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const userId = session?.user.id;
  const { data: showPriceInMarketView = false } = useShowPriceInMarketView(userId);
  const setShowPriceInMarketView = useSetShowPriceInMarketView(userId);

  const { data: stores, isLoading } = useStores(currentHousehold?.id);
  const addMutation = useAddStoreMutation();
  const updateMutation = useUpdateStoreMutation();
  const deleteMutation = useDeleteStoreMutation();

  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState<string>(STORE_COLOR_PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  async function handleAdd() {
    if (!currentHousehold || !newStoreName.trim()) return;
    const trimmed = newStoreName.trim();

    // Maerkte existieren pro Haushalt nur einmal, unabhaengig von
    // Gross-/Kleinschreibung.
    const existing = findStoreByName(stores ?? [], trimmed);
    if (existing) {
      Alert.alert(
        t('shoppingList.stores.alreadyExistsTitle'),
        t('shoppingList.stores.alreadyExistsBody', { store: existing.name }),
      );
      setNewStoreName('');
      return;
    }

    try {
      await addMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: trimmed,
        color: newStoreColor,
      });
      setNewStoreName('');
    } catch (err) {
      Alert.alert(
        t('shoppingList.stores.errorTitle'),
        err instanceof Error ? err.message : t('shoppingList.stores.createError'),
      );
    }
  }

  async function handleUpdate(id: string) {
    if (!currentHousehold || !editingName.trim()) return;
    const trimmed = editingName.trim();

    const existing = findStoreByName(
      (stores ?? []).filter((s) => s.id !== id),
      trimmed,
    );
    if (existing) {
      Alert.alert(
        t('shoppingList.stores.alreadyExistsTitle'),
        t('shoppingList.stores.alreadyExistsBody', { store: existing.name }),
      );
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        household_id: currentHousehold.id,
        name: trimmed,
        color: editingColor,
      });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      Alert.alert(
        t('shoppingList.stores.errorTitle'),
        err instanceof Error ? err.message : t('shoppingList.stores.updateError'),
      );
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!currentHousehold) return;
    Alert.alert(
      t('shoppingList.stores.deleteTitle'),
      t('shoppingList.stores.deleteBody', { store: name }),
      [
        { text: t('shoppingList.screen.cancel'), style: 'cancel' },
        {
          text: t('shoppingList.screen.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id, household_id: currentHousehold.id });
            } catch (err) {
              Alert.alert(
                t('shoppingList.stores.errorTitle'),
                err instanceof Error ? err.message : t('shoppingList.stores.deleteError'),
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      title={t('shoppingList.screen.title')}
      subtitle={currentHousehold?.name}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <Card>
        <Row justify="space-between">
          <View style={styles.flex}>
            <Txt variant="body" weight="600">
              {t('shoppingList.stores.priceInMarketView.label')}
            </Txt>
            <Txt variant="caption" tone="secondary">
              {t('shoppingList.stores.priceInMarketView.hint')}
            </Txt>
          </View>
          <Switch
            value={showPriceInMarketView}
            onValueChange={(value) => setShowPriceInMarketView.mutate(value)}
            accessibilityLabel={t('shoppingList.stores.priceInMarketView.label')}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.surface}
          />
        </Row>
      </Card>

      {/* Formular zum Anlegen eines neuen Supermarkts/Geschäfts */}
      <Card title={t('shoppingList.stores.addStore.title')}>
        <View style={styles.form}>
          {/* Eingabefeld für den Marktnamen */}
          <TextField
            placeholder={t('shoppingList.stores.addStore.namePlaceholder')}
            value={newStoreName}
            onChangeText={setNewStoreName}
          />
          {/* Schnellauswahl beliebter Supermarktketten (Presets) */}
          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.addStore.suggestions')}
          </Txt>
          <Row wrap>
            {STORE_PRESETS.map((preset) => (
              <Press
                key={preset.name}
                onPress={() => setNewStoreName(preset.name)}
                accessibilityRole="button"
                haptic="selection"
                // Dynamische Preset-Farbe
                style={[
                  styles.presetChip,
                  { backgroundColor: `${preset.color}18`, borderColor: preset.color },
                ]}>
                {/* Dynamische Preset-Farbe */}
                <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                <Txt
                  variant="body"
                  weight="600"
                  // Dynamische Preset-Farbe
                  color={preset.color}>
                  {preset.name}
                </Txt>
              </Press>
            ))}
          </Row>

          {/* Farbauswahl-Palette für den Markt */}
          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.addStore.color')}
          </Txt>
          <Row wrap>
            {STORE_COLOR_PALETTE.map((color) => (
              <Press
                key={color}
                onPress={() => setNewStoreColor(color)}
                accessibilityRole="button"
                accessibilityLabel={t('shoppingList.stores.addStore.colorAccessibility', { color })}
                accessibilityState={{ selected: newStoreColor === color }}
                selected={newStoreColor === color}
                style={styles.swatchButton}
                haptic="selection">
                <View style={[styles.swatch, { backgroundColor: color }]} />
              </Press>
            ))}
          </Row>
          {/* Hinzufügen-Button */}
          <Button
            title={t('shoppingList.stores.addStore.add')}
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newStoreName.trim()}
          />
        </View>
      </Card>

      {/* Liste aller angelegten Märkte mit Bearbeiten- und Löschen-Aktionen */}
      <Card title={t('shoppingList.stores.existingStores.title')}>
        {isLoading ? (
          <Txt>{t('shoppingList.stores.existingStores.loading')}</Txt>
        ) : stores?.length === 0 ? (
          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.existingStores.empty')}
          </Txt>
        ) : (
          <View style={styles.storeList}>
            {stores?.map((store, index) => {
              const isEditing = editingId === store.id;

              return (
                <View key={store.id}>
                  <View style={styles.manageRow}>
                    {isEditing ? (
                      /* Inline-Bearbeitung für Markt (Name & Farbe) */
                      <View style={styles.storeList}>
                        <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                        <Txt variant="body" tone="secondary">
                          {t('shoppingList.stores.addStore.color')}
                        </Txt>
                        <Row wrap>
                          {STORE_COLOR_PALETTE.map((color) => (
                            <Press
                              key={color}
                              onPress={() => setEditingColor(color)}
                              accessibilityRole="button"
                              accessibilityLabel={t(
                                'shoppingList.stores.addStore.colorAccessibility',
                                {
                                  color,
                                },
                              )}
                              accessibilityState={{ selected: editingColor === color }}
                              selected={editingColor === color}
                              style={styles.swatchButton}
                              haptic="selection">
                              <View style={[styles.swatch, { backgroundColor: color }]} />
                            </Press>
                          ))}
                        </Row>
                        <Row align="stretch">
                          <View style={styles.flex}>
                            <Button
                              title={t('shoppingList.stores.existingStores.save')}
                              onPress={() => handleUpdate(store.id)}
                              loading={updateMutation.isPending}
                              disabled={!editingName.trim()}
                            />
                          </View>
                          <View style={styles.flex}>
                            <Button
                              title={t('shoppingList.stores.existingStores.cancel')}
                              variant="secondary"
                              onPress={() => {
                                setEditingId(null);
                                setEditingName('');
                              }}
                            />
                          </View>
                        </Row>
                      </View>
                    ) : (
                      <Row justify="space-between">
                        <Row style={styles.flex}>
                          {/* Dynamische Markt-Farbe */}
                          <View style={[styles.storeColorDot, { backgroundColor: store.color }]} />
                          <Txt variant="body" weight="700" numberOfLines={1} style={styles.flex}>
                            {store.name}
                          </Txt>
                        </Row>
                        <Row>
                          <HeaderIconButton
                            onPress={() => {
                              setEditingId(store.id);
                              setEditingName(store.name);
                              setEditingColor(store.color);
                            }}
                            label={t('shoppingList.stores.existingStores.editAccessibility', {
                              store: store.name,
                            })}
                            variant="modal-close">
                            <Txt variant="body">✎</Txt>
                          </HeaderIconButton>
                          <HeaderIconButton
                            onPress={() => handleDelete(store.id, store.name)}
                            label={t('shoppingList.stores.existingStores.deleteAccessibility', {
                              store: store.name,
                            })}
                            variant="modal-close">
                            <Txt variant="body" tone="danger">
                              🗑
                            </Txt>
                          </HeaderIconButton>
                        </Row>
                      </Row>
                    )}
                  </View>
                  {index < (stores?.length ?? 0) - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}
