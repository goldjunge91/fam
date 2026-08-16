import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { Spacing } from '@/constants/theme';

type MealPlannerVersion = 'original' | 'v2';

const VERSIONS = [
  { value: 'original', label: 'Original' },
  { value: 'v2', label: 'V2' },
] as const;

/** Temporärer Vergleichsschalter, bis die bevorzugte Essensplan-Version feststeht. */
export function MealPlannerVersionSwitcher({ selected }: { selected: MealPlannerVersion }) {
  return (
    <View style={styles.root}>
      <SegmentedControl
        label="Essensplan-Version"
        options={VERSIONS}
        selected={selected}
        onSelect={(version) =>
          router.replace(version === 'original' ? '/meal-planner' : '/meal-planner-v2')
        }
        appearance="surface"
        size="compact"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: Spacing.one,
  },
});
