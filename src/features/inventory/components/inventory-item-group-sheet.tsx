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

export function InventoryItemGroupSheet({
  visible,
  group,
  onClose,
  onSelectLot,
}: InventoryItemGroupSheetProps) {
  const sheetStyle = useSheetShadowStyle();
  const { colors } = useTheme();

  if (!group) return null;

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
              <Txt variant="body" tone="secondary">
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

          <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
            MHD-Einträge
          </Txt>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="fridge-group-lots-content">
            {group.lots.map((lot) => {
              const packageHint = formatPackageHint(lot.package_size, lot.package_size_unit);
              const location = lot.location_name ?? 'Kein Lagerort';
              const amount = formatAmount(lot.quantity, lot.unit);
              const expiryDate = formatExpiryDate(lot.expiry_date);
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
                      backgroundColor:
                        getExpiryInfo(lot.expiry_date, new Date()).themeColor === 'danger'
                          ? colors.tomato
                          : getExpiryInfo(lot.expiry_date, new Date()).themeColor === 'warning'
                            ? colors.carrot
                            : colors.textMuted,
                    }}
                  />
                  <View className="fridge-group-lot-copy">
                    <Txt variant="body" weight="700">
                      MHD {expiryDate}
                    </Txt>
                    <Txt variant="caption" tone="secondary" numberOfLines={1}>
                      {formatExpiryStatus(lot)} · {location}
                      {packageHint ? ` · ${packageHint}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
                    {amount}
                  </Txt>
                  <Txt tone="secondary">›</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
