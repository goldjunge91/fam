import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@/constants/ui';
import { type AppLanguage, getLanguageOverride, setLanguageOverride } from '@/i18n';

type LanguageSelection = AppLanguage | 'device';

const LANGUAGE_OPTIONS: readonly {
  value: LanguageSelection;
  labelKey: 'common.german' | 'common.english' | 'common.deviceLanguage';
}[] = [
  { value: 'device', labelKey: 'common.deviceLanguage' },
  { value: 'de', labelKey: 'common.german' },
  { value: 'en', labelKey: 'common.english' },
];

export function LanguageOverrideControl() {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<LanguageSelection>(
    () => getLanguageOverride() ?? 'device',
  );

  function handleSelect(nextSelection: LanguageSelection) {
    setSelection(nextSelection);
    void setLanguageOverride(nextSelection === 'device' ? null : nextSelection);
  }

  return (
    <SegmentedControl
      label={t('common.appLanguage')}
      options={LANGUAGE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
      selected={selection}
      onSelect={handleSelect}
      appearance="surface"
      size="compact"
    />
  );
}
