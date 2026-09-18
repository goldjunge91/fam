import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { SettingsRow } from '@/features/settings/settings-menu';
import {
  type NaturalLanguageBetaConsentDimension,
  type NaturalLanguageBetaConsentValue,
  naturalLanguageBetaConsentPort,
} from './natural-language-beta-consent';

function nextConsent(consent: NaturalLanguageBetaConsentValue): 'granted' | 'revoked' {
  return consent === 'granted' ? 'revoked' : 'granted';
}

type NaturalLanguageBetaConsentSettingProps = {
  dimension?: NaturalLanguageBetaConsentDimension;
};

const CONSENT_CONFIG: Record<NaturalLanguageBetaConsentDimension, { icon: string }> = {
  automaticApplication: { icon: '✨' },
  qualityMetrics: { icon: '📊' },
  contentData: { icon: '🧹' },
};

function getConsent(
  dimension: NaturalLanguageBetaConsentDimension,
  userId: string,
): Promise<NaturalLanguageBetaConsentValue> {
  if (dimension === 'automaticApplication') {
    return naturalLanguageBetaConsentPort.getAutomaticApplicationConsent(userId);
  }
  if (dimension === 'qualityMetrics') {
    return naturalLanguageBetaConsentPort.getQualityMetricsConsent(userId);
  }
  return naturalLanguageBetaConsentPort.getContentDataConsent(userId);
}

function saveConsent(
  dimension: NaturalLanguageBetaConsentDimension,
  userId: string,
  consent: Exclude<NaturalLanguageBetaConsentValue, 'undecided'>,
): Promise<void> {
  if (dimension === 'automaticApplication') {
    return naturalLanguageBetaConsentPort.setAutomaticApplicationConsent(userId, consent);
  }
  if (dimension === 'qualityMetrics') {
    return naturalLanguageBetaConsentPort.setQualityMetricsConsent(userId, consent);
  }
  return naturalLanguageBetaConsentPort.setContentDataConsent(userId, consent);
}

export function NaturalLanguageBetaConsentSetting({
  dimension = 'automaticApplication',
}: NaturalLanguageBetaConsentSettingProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const [consent, setConsent] = useState<NaturalLanguageBetaConsentValue>('undecided');
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const translationKey = `settings.groups.app.naturalLanguageBeta.${dimension}`;

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
    void getConsent(dimension, userId)
      .then((nextConsentValue) => {
        if (active) setConsent(nextConsentValue);
      })
      .catch(() => {
        // Ein fehlender lokaler Snapshot ist kein Grund, Settings zu blockieren.
        if (active) setConsent('undecided');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dimension, userId]);

  async function handlePress() {
    if (!userId || loading || saving) return;

    const previousConsent = consent;
    const nextConsentValue = nextConsent(previousConsent);
    setConsent(nextConsentValue);
    setSaving(true);

    try {
      await saveConsent(dimension, userId, nextConsentValue);
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
  const config = CONSENT_CONFIG[dimension];

  return (
    <SettingsRow
      icon={config.icon}
      label={t(`${translationKey}.label`)}
      hint={t(`${translationKey}.hint`)}
      value={value}
      onPress={handlePress}
      disabled={!userId || loading || saving}
    />
  );
}
