import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Press, Txt } from '@/constants/ui';
import {
  type FoodSelection,
  getFoodRuleLabel,
  type ProfileFoodRules,
} from '@/features/profile/domain/food-rules';
import { profileEditStyles } from '@/features/profile/profile-edit-styles';

type FoodRuleKind = keyof ProfileFoodRules;

type FoodRulesSummaryProps = {
  rules: ProfileFoodRules;
  onSelect: (kind: FoodRuleKind) => void;
};

function summarize<Code extends string>(
  selections: FoodSelection<Code>[],
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (selections.length === 0) return t('profile.foodRules.empty');

  return selections
    .map((selection) =>
      selection.source === 'custom' ? selection.label : getFoodRuleLabel(t, selection.code),
    )
    .join(', ');
}

function SummaryRow({
  label,
  summary,
  bordered,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  summary: string;
  bordered?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[profileEditStyles.summaryRow, bordered && profileEditStyles.summaryRowBordered]}>
      <Txt variant="body" weight="700" style={profileEditStyles.summaryLabel}>
        {label}
      </Txt>
      <Txt variant="body" tone="secondary" style={profileEditStyles.summaryValue} numberOfLines={2}>
        {summary}
      </Txt>
      <View style={profileEditStyles.summaryChevron}>
        <Txt
          variant="title"
          tone="secondary"
          accessibilityElementsHidden={true}
          importantForAccessibility="no">
          ›
        </Txt>
      </View>
    </Press>
  );
}

export function FoodRulesSummary({ rules, onSelect }: FoodRulesSummaryProps) {
  const { t } = useTranslation();
  const allergiesLabel = t('profile.foodRules.allergies');
  const intolerancesLabel = t('profile.foodRules.intolerances');
  const dislikedLabel = t('profile.foodRules.dislikedFoods');

  return (
    <Card style={profileEditStyles.foodRulesCard}>
      <View style={profileEditStyles.summaryHeading}>
        <Txt variant="body" weight="700">
          {t('profile.summary.foodRules')}
        </Txt>
      </View>
      <SummaryRow
        label={allergiesLabel}
        summary={summarize(rules.allergies, t)}
        accessibilityLabel={t('profile.summary.editSummary', {
          label: allergiesLabel,
          summary: summarize(rules.allergies, t),
        })}
        bordered
        onPress={() => onSelect('allergies')}
      />
      <SummaryRow
        label={intolerancesLabel}
        summary={summarize(rules.intolerances, t)}
        accessibilityLabel={t('profile.summary.editSummary', {
          label: intolerancesLabel,
          summary: summarize(rules.intolerances, t),
        })}
        bordered
        onPress={() => onSelect('intolerances')}
      />
      <SummaryRow
        label={dislikedLabel}
        summary={summarize(rules.dislikedFoods, t)}
        accessibilityLabel={t('profile.summary.editSummary', {
          label: dislikedLabel,
          summary: summarize(rules.dislikedFoods, t),
        })}
        onPress={() => onSelect('dislikedFoods')}
      />
    </Card>
  );
}
