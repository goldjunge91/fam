import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { SettingsRow } from '@/features/settings/settings-menu';
import {
  type NaturalLanguageBetaAutomaticApplicationConsent,
  naturalLanguageBetaConsentPort,
} from './natural-language-beta-consent';

function nextConsent(
  consent: NaturalLanguageBetaAutomaticApplicationConsent,
): 'granted' | 'revoked' {
  return consent === 'granted' ? 'revoked' : 'granted';
}

export function NaturalLanguageBetaConsentSetting() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const [consent, setConsent] =
    useState<NaturalLanguageBetaAutomaticApplicationConsent>('undecided');
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setConsent('undecided');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void naturalLanguageBetaConsentPort
      .getAutomaticApplicationConsent(userId)
      .then((nextConsentValue) => {
        if (active) setConsent(nextConsentValue);
      })
      .catch(() => {
        if (active) setConsent('undecided');
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

    const previousConsent = consent;
    const nextConsentValue = nextConsent(previousConsent);
    setConsent(nextConsentValue);
    setSaving(true);

    try {
      await naturalLanguageBetaConsentPort.setAutomaticApplicationConsent(userId, nextConsentValue);
    } catch {
      setConsent(previousConsent);
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
    : t(`settings.groups.app.naturalLanguageBeta.status.${consent}`);

  return (
    <SettingsRow
      icon="✨"
      label={t('settings.groups.app.naturalLanguageBeta.automaticApplication.label')}
      hint={t('settings.groups.app.naturalLanguageBeta.automaticApplication.hint')}
      value={value}
      onPress={handlePress}
      disabled={!userId || loading || saving}
    />
  );
}
