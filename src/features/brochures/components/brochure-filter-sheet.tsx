import { Modal, Pressable, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, Txt } from '@/constants/ui';
import type { BrochureMarketGroup } from '../market-groups';

type BrochureFilterSheetProps = {
  visible: boolean;
  groups: readonly BrochureMarketGroup[];
  selectedStoreIds: ReadonlySet<string>;
  brochureCounts: ReadonlyMap<string, number>;
  resultCount: number;
  onClose: () => void;
  onReset: () => void;
  onToggleGroup: (storeIds: readonly string[]) => void;
  onToggleStore: (storeId: string) => void;
  onApply: () => void;
};

export function BrochureFilterSheet({
  visible,
  groups,
  selectedStoreIds,
  brochureCounts,
  resultCount,
  onClose,
  onReset,
  onToggleGroup,
  onToggleStore,
  onApply,
}: BrochureFilterSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Filter schließen">
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}
          accessible={false}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Txt variant="heading">Filter</Txt>
            <Pressable accessibilityRole="button" onPress={onReset} style={styles.headerAction}>
              <Txt variant="body" tone="secondary" weight="500">
                Zurücksetzen
              </Txt>
            </Pressable>
          </View>

          <ScrollView style={styles.groupList} showsVerticalScrollIndicator={false}>
            {groups.map((group) => {
              const storeIds = group.stores.map((store) => store.id);
              const selectedCount = storeIds.filter((storeId) =>
                selectedStoreIds.has(storeId),
              ).length;
              const groupCheckState =
                selectedCount === 0 ? false : selectedCount === storeIds.length ? true : 'mixed';

              return (
                <View key={group.id}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${group.label}, ${selectedCount} von ${storeIds.length} Märkten`}
                    accessibilityState={{ checked: groupCheckState }}
                    onPress={() => onToggleGroup(storeIds)}
                    style={[styles.groupRow, { borderTopColor: colors.border }]}>
                    <View style={styles.groupCopy}>
                      <Txt variant="body" weight="600">
                        {group.label}
                      </Txt>
                      <Txt variant="caption" tone="secondary">
                        {selectedCount} von {storeIds.length} Märkten
                      </Txt>
                    </View>
                    <FilterCheck
                      selected={groupCheckState}
                      accentColor={colors.accent}
                      surfaceColor={colors.backgroundElement}
                      borderColor={colors.border}
                    />
                  </Pressable>
                  {group.stores.map((store) => {
                    const isSelected = selectedStoreIds.has(store.id);
                    const brochureCount = brochureCounts.get(store.id) ?? 0;

                    return (
                      <Pressable
                        key={store.id}
                        accessibilityRole="checkbox"
                        accessibilityLabel={store.name}
                        accessibilityState={{ checked: isSelected }}
                        onPress={() => onToggleStore(store.id)}
                        style={[styles.storeRow, { borderBottomColor: colors.border }]}>
                        <Txt variant="body" tone="secondary" style={styles.storeName}>
                          {store.name}
                        </Txt>
                        <Txt variant="caption" tone="secondary" style={styles.storeCount}>
                          {brochureCount}
                        </Txt>
                        <FilterCheck
                          selected={isSelected}
                          accentColor={colors.accent}
                          surfaceColor={colors.backgroundElement}
                          borderColor={colors.border}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            style={[styles.applyButton, { backgroundColor: colors.accent }]}>
            <Txt variant="body" tone="onAccent" weight="600">
              {resultCount} Prospekte anzeigen
            </Txt>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterCheck({
  selected,
  accentColor,
  surfaceColor,
  borderColor,
}: {
  selected: boolean | 'mixed';
  accentColor: string;
  surfaceColor: string;
  borderColor: string;
}) {
  return (
    <View
      style={[
        styles.checkbox,
        {
          backgroundColor: selected ? accentColor : surfaceColor,
          borderColor: selected ? accentColor : borderColor,
        },
      ]}>
      {selected ? (
        <Txt variant="caption" tone="onAccent" weight="700" style={styles.checkmark}>
          {selected === 'mixed' ? '−' : '✓'}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    flexShrink: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.s,
    marginBottom: space.sm,
  },
  header: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    marginBottom: space.xs,
  },
  headerAction: {
    minHeight: MIN_TOUCH_SIZE,
    justifyContent: 'center',
  },
  groupList: {
    flexShrink: 1,
  },
  groupRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderTopWidth: theme.borderWidth.base,
  },
  groupCopy: {
    flex: 1,
    gap: space.xs,
  },
  storeRow: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: theme.borderWidth.base,
    paddingLeft: space.lg,
  },
  storeName: {
    flex: 1,
  },
  storeCount: {
    minWidth: 24,
    textAlign: 'right',
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
    borderRadius: radius.xs,
  },
  checkmark: {
    lineHeight: 16,
  },
  applyButton: {
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginTop: space.md,
  },
}));
