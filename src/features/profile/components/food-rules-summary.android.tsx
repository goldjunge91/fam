import { Pressable, View } from 'react-native';

import { Surface, Txt } from '@/constants/ui';
import {
  ALLERGY_PRESETS,
  type FoodSelection,
  INTOLERANCE_PRESETS,
  type ProfileFoodRules,
} from '@/features/profile/domain/food-rules';

type FoodRuleKind = keyof ProfileFoodRules;

type FoodRulesSummaryProps = {
  rules: ProfileFoodRules;
  onSelect: (kind: FoodRuleKind) => void;
};

function summarize<Code extends string>(
  selections: FoodSelection<Code>[],
  presets: readonly { code: Code; label: string }[],
) {
  if (selections.length === 0) return 'Keine Angaben';

  return selections
    .map((selection) =>
      selection.source === 'custom'
        ? selection.label
        : (presets.find(({ code }) => code === selection.code)?.label ?? selection.code),
    )
    .join(', ');
}

function SummaryRow({
  label,
  summary,
  bordered,
  onPress,
}: {
  label: string;
  summary: string;
  bordered?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={`${label} bearbeiten. ${summary}`}
      className={`profile-food-rules-summary-row ${
        bordered ? 'profile-food-rules-summary-row-bordered' : ''
      }`}>
      <Txt variant="body" weight="700" className="w-32">
        {label}
      </Txt>
      <Txt variant="body" tone="secondary" className="flex-1 text-right" numberOfLines={2}>
        {summary}
      </Txt>
      <Txt variant="title" tone="secondary" aria-hidden>
        ›
      </Txt>
    </Pressable>
  );
}

export function FoodRulesSummary({ rules, onSelect }: FoodRulesSummaryProps) {
  return (
    <View className="gap-two">
      <View className="gap-half">
        <Txt variant="body" weight="700">
          Lebensmittel &amp; Verträglichkeit
        </Txt>
        <Txt variant="body" tone="secondary">
          Keine medizinische Diagnose
        </Txt>
      </View>
      <Surface tone="surface" className="profile-food-rules-summary">
        <SummaryRow
          label="Allergien"
          summary={summarize(rules.allergies, ALLERGY_PRESETS)}
          bordered
          onPress={() => onSelect('allergies')}
        />
        <SummaryRow
          label="Unverträglichkeiten"
          summary={summarize(rules.intolerances, INTOLERANCE_PRESETS)}
          bordered
          onPress={() => onSelect('intolerances')}
        />
        <SummaryRow
          label="Mag ich nicht"
          summary={summarize(rules.dislikedFoods, [])}
          onPress={() => onSelect('dislikedFoods')}
        />
      </Surface>
    </View>
  );
}
