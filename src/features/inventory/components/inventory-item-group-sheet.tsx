import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { getExpiryInfo } from '../expiry';
import type { InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemGroupSheetProps = {
  visible: boolean;
  group: InventoryItemGroup | null;
  onClose: () => void;
  onSelectLot: (lot: LocalInventoryItem) => void;
  onHistory: () => void;
};

function formatExpiryDate(value: string | null): string {
  if (!value) return 'ohne MHD';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatExpiryStatus(lot: LocalInventoryItem): string {
  const expiry = getExpiryInfo(lot.expiry_date, new Date());
  if (expiry.daysLeft === null) return 'ohne MHD';
  if (expiry.daysLeft < 0) return expiry.label;
  return expiry.daysLeft === 0 ? 'heute' : expiry.label;
}

export function formatStateSubtitle(lots: LocalInventoryItem[]): string {
  const earliest = lots.reduce<LocalInventoryItem | null>((current, lot) => {
    if (!current) return lot;
    const currentTime = current.expiry_date
      ? new Date(`${current.expiry_date}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    const lotTime = lot.expiry_date
      ? new Date(`${lot.expiry_date}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY;
    return lotTime < currentTime ? lot : current;
  }, null);
  if (!earliest?.expiry_date) return 'unbegrenzt haltbar';
  return formatExpiryStatus(earliest);
}

export function InventoryItemGroupSheet({
  visible,
  group,
  onClose,
  onSelectLot,
  onHistory,
}: InventoryItemGroupSheetProps) {
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();

  if (!group) return null;

  const sealedLots = group.lots.filter((lot) => !lot.opened_at);
  const openedLots = group.lots.filter((lot) => !!lot.opened_at);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="MHD-Details schließen"
        />
        <View className="fridge-group-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />

          <View className="fridge-group-header">
            <View className="fridge-group-header-copy">
              <Txt variant="title">{group.name}</Txt>
              <Txt variant="caption" tone="secondary">
                {formatAmount(group.quantity, group.unit)} gesamt · {group.lots.length} MHD-
                {group.lots.length === 1 ? 'Eintrag' : 'Einträge'}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="edit-fridge-close-button">
              <Txt variant="body" tone="secondary">
                ×
              </Txt>
            </Pressable>
          </View>

          <View className="inventory-state-summary">
            {sealedLots.length > 0 ? (
              <View className="inventory-state-card inventory-state-card-sealed">
                <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                  Versiegelt
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(
                    sealedLots.reduce((sum, lot) => sum + lot.quantity, 0),
                    group.unit,
                  )}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(sealedLots)}
                </Txt>
              </View>
            ) : null}
            {openedLots.length > 0 ? (
              <View className="inventory-state-card inventory-state-card-open">
                <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                  Geöffnet
                </Txt>
                <Txt variant="body" weight="700">
                  {formatAmount(
                    openedLots.reduce((sum, lot) => sum + lot.quantity, 0),
                    group.unit,
                  )}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatStateSubtitle(openedLots)}
                </Txt>
              </View>
            ) : null}
          </View>

          <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
            MHD-Einträge
          </Txt>

          <Pressable
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel={`${group.name} Verlauf öffnen`}
            className="self-start py-one">
            <Txt variant="body" color={colors.accent} weight="700">
              Produkt-Verlauf öffnen ›
            </Txt>
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="fridge-group-lots-content">
            {group.lots.map((lot) => {
              const packageHint = formatPackageHint(lot.package_size, lot.package_size_unit);
              const location = lot.location_name ?? 'Kein Lagerort';
              const amount = formatAmount(lot.quantity, lot.unit);
              const expiryDate = formatExpiryDate(lot.expiry_date);
              const expiry = getExpiryInfo(lot.expiry_date, new Date());
              const statusColor =
                expiry.themeColor === 'danger'
                  ? colors.tomato
                  : lot.opened_at || expiry.themeColor === 'warning'
                    ? colors.carrot
                    : colors.success;
              return (
                <Pressable
                  key={lot.id}
                  onPress={() => onSelectLot(lot)}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}, ${amount}, MHD ${expiryDate}, ${location}`}
                  className="fridge-group-lot">
                  <View
                    className="fridge-group-lot-status"
                    style={{
                      backgroundColor: statusColor,
                    }}
                  />
                  <View className="fridge-group-lot-copy">
                    <Txt variant="body" weight="700">
                      MHD {expiryDate}
                    </Txt>
                    <Txt variant="caption" tone="secondary" numberOfLines={1}>
                      {lot.opened_at ? 'Geöffnet' : 'Versiegelt'} · {formatExpiryStatus(lot)} ·{' '}
                      {location}
                      {packageHint ? ` · ${packageHint}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
                    {amount}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    ›
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
