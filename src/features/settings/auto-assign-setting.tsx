import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { SettingsRow } from '@/features/settings/settings-menu';
import { type AutoAssignValue, autoAssignPort } from './auto-assign';

function nextAutoAssign(value: AutoAssignValue): 'on' | 'off' {
  return value === 'on' ? 'off' : 'on';
}

export function AutoAssignSetting() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const [autoAssign, setAutoAssign] = useState<AutoAssignValue>('unset');
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setAutoAssign('unset');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void autoAssignPort
      .get(userId)
      .then((nextValue) => {
        if (active) setAutoAssign(nextValue);
      })
      .catch(() => {
        if (active) setAutoAssign('unset');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  async function handlePress() {
    if (!userId || loading || saving) return;

    const previousValue = autoAssign;
    const nextValue = nextAutoAssign(previousValue);
    setAutoAssign(nextValue);
    setSaving(true);

    try {
      await autoAssignPort.set(userId, nextValue);
    } catch {
      setAutoAssign(previousValue);
      Alert.alert(
        t('settings.groups.app.naturalLanguageBeta.errorTitle'),
        t('settings.groups.app.naturalLanguageBeta.errorBody'),
      );
    } finally {
      setSaving(false);
    }
  }

  const value = loading
    ? t('settings.groups.app.naturalLanguageBeta.status.loading')
    : t(`settings.groups.app.naturalLanguageBeta.status.${autoAssign}`);

  return (
    <SettingsRow
      icon="✨"
      label={t('settings.groups.app.naturalLanguageBeta.autoAssign.label')}
      hint={t('settings.groups.app.naturalLanguageBeta.autoAssign.hint')}
      value={value}
      onPress={handlePress}
      disabled={!userId || loading || saving}
    />
  );
}
