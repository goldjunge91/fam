import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Button, TextField, Txt } from '@/constants/ui';
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
        <View className="row-between gap-two">
          <View className="flex-1">
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
        </View>
      </Card>

      {/* Formular zum Anlegen eines neuen Supermarkts/Geschäfts */}
      <Card title={t('shoppingList.stores.addStore.title')}>
        <View className="gap-three mt-two">
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
          <View className="row-wrap">
            {STORE_PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => setNewStoreName(preset.name)}
                accessibilityRole="button"
                className="store-preset-chip"
                // Dynamische Preset-Farbe
                style={{ backgroundColor: `${preset.color}18`, borderColor: preset.color }}>
                {/* Dynamische Preset-Farbe */}
                <View className="store-preset-dot" style={{ backgroundColor: preset.color }} />
                <Txt
                  variant="body"
                  weight="600"
                  // Dynamische Preset-Farbe
                  style={{ color: preset.color }}>
                  {preset.name}
                </Txt>
              </Pressable>
            ))}
          </View>

          {/* Farbauswahl-Palette für den Markt */}
          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.addStore.color')}
          </Txt>
          <View className="row-wrap">
            {STORE_COLOR_PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => setNewStoreColor(color)}
                accessibilityRole="button"
                accessibilityLabel={t('shoppingList.stores.addStore.colorAccessibility', { color })}
                accessibilityState={{ selected: newStoreColor === color }}
                className="store-color-swatch"
                // Dynamische Palettenfarbe & Auswahlrand
                style={{
                  backgroundColor: color,
                  borderColor: newStoreColor === color ? theme.text : 'transparent',
                }}
              />
            ))}
          </View>
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
          <View className="col-gap">
            {stores?.map((store) => {
              const isEditing = editingId === store.id;

              return (
                <View key={store.id} className="store-manage-row">
                  {isEditing ? (
                    /* Inline-Bearbeitung für Markt (Name & Farbe) */
                    <View className="col-gap">
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <Txt variant="body" tone="secondary">
                        {t('shoppingList.stores.addStore.color')}
                      </Txt>
                      <View className="row-wrap">
                        {STORE_COLOR_PALETTE.map((color) => (
                          <Pressable
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
                            className="store-color-swatch"
                            // Dynamische Palettenfarbe & Auswahlrand
                            style={{
                              backgroundColor: color,
                              borderColor: editingColor === color ? theme.text : 'transparent',
                            }}
                          />
                        ))}
                      </View>
                      <View className="input-row mt-one">
                        <View className="flex-1">
                          <Button
                            title={t('shoppingList.stores.existingStores.save')}
                            onPress={() => handleUpdate(store.id)}
                            loading={updateMutation.isPending}
                            disabled={!editingName.trim()}
                          />
                        </View>
                        <View className="flex-1">
                          <Button
                            title={t('shoppingList.stores.existingStores.cancel')}
                            variant="secondary"
                            onPress={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="row-between">
                      <View className="row-center flex-1">
                        {/* Dynamische Markt-Farbe */}
                        <View
                          className="store-color-dot"
                          style={{ backgroundColor: store.color }}
                        />
                        <Txt variant="body" weight="700" numberOfLines={1} className="flex-1">
                          {store.name}
                        </Txt>
                      </View>
                      <View className="row-center">
                        <Pressable
                          onPress={() => {
                            setEditingId(store.id);
                            setEditingName(store.name);
                            setEditingColor(store.color);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            'shoppingList.stores.existingStores.editAccessibility',
                            {
                              store: store.name,
                            },
                          )}
                          className="btn-modal-close">
                          <Txt variant="body">✎</Txt>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(store.id, store.name)}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            'shoppingList.stores.existingStores.deleteAccessibility',
                            { store: store.name },
                          )}
                          className="btn-modal-close">
                          <Txt variant="body" tone="danger">
                            🗑
                          </Txt>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}
