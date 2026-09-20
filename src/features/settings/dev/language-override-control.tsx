import { useState } from 'react';

import { SegmentedControl } from '@/constants/ui';
import { type AppLanguage, getLanguageOverride, setLanguageOverride } from '@/i18n';

type LanguageSelection = AppLanguage | 'device';

const LANGUAGE_OPTIONS: readonly {
  value: LanguageSelection;
  label: string;
}[] = [
  { value: 'device', label: 'Gerätesprache' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
];

export function LanguageOverrideControl() {
  const [selection, setSelection] = useState<LanguageSelection>(
    () => getLanguageOverride() ?? 'device',
  );

  function handleSelect(nextSelection: LanguageSelection) {
    setSelection(nextSelection);
    void setLanguageOverride(nextSelection === 'device' ? null : nextSelection);
  }

  return (
    <SegmentedControl
      label="App-Sprache"
      options={LANGUAGE_OPTIONS}
      selected={selection}
      onSelect={handleSelect}
      appearance="surface"
      size="compact"
    />
  );
}
