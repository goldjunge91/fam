import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Button, Card, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  getNameCorrections,
  type NameCorrection,
  normalizeCorrectionName,
  updateNameCorrection,
} from '@/features/shopping-list/stt-beta/name-corrections';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.lg,
  },
  corrections: {
    gap: theme.space.lg,
  },
  correction: {
    gap: theme.space.sm,
  },
  correctionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    paddingBottom: theme.space.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  action: {
    flex: 1,
  },
}));

export function NameCorrectionsSettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const [corrections, setCorrections] = useState<readonly NameCorrection[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(userId));
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setCorrections([]);
      setDrafts({});
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void getNameCorrections(userId)
      .then((nextCorrections) => {
        if (!active) return;
        setCorrections(nextCorrections);
        setDrafts(
          Object.fromEntries(
            nextCorrections.map((correction) => [
              normalizeCorrectionName(correction.original),
              correction.corrected,
            ]),
          ),
        );
      })
      .catch(() => {
        if (!active) return;
        Alert.alert(
          t('settings.groups.app.naturalLanguageBeta.corrections.loadErrorTitle'),
          t('settings.groups.app.naturalLanguageBeta.corrections.loadErrorBody'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t, userId]);

  function updateDraft(correction: NameCorrection, value: string) {
    const key = normalizeCorrectionName(correction.original);
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  async function saveCorrection(correction: NameCorrection) {
    if (!userId) return;
    const key = normalizeCorrectionName(correction.original);
    const corrected = drafts[key]?.trim() ?? '';
    if (!corrected || normalizeCorrectionName(corrected) === key) return;

    setBusyKey(key);
    try {
      const nextCorrections = await updateNameCorrection(userId, correction.original, corrected);
      setCorrections(nextCorrections);
      setDrafts((current) => ({ ...current, [key]: corrected }));
    } catch {
      Alert.alert(
        t('settings.groups.app.naturalLanguageBeta.corrections.saveErrorTitle'),
        t('settings.groups.app.naturalLanguageBeta.corrections.saveErrorBody'),
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteCorrection(correction: NameCorrection) {
    if (!userId) return;
    const key = normalizeCorrectionName(correction.original);
    setBusyKey(key);

    try {
      const nextCorrections = await updateNameCorrection(userId, correction.original, null);
      setCorrections(nextCorrections);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch {
      Alert.alert(
        t('settings.groups.app.naturalLanguageBeta.corrections.deleteErrorTitle'),
        t('settings.groups.app.naturalLanguageBeta.corrections.deleteErrorBody'),
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Screen
      title={t('settings.groups.app.naturalLanguageBeta.corrections.title')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View style={styles.content}>
        <Txt variant="body" tone="secondary">
          {t('settings.groups.app.naturalLanguageBeta.corrections.description')}
        </Txt>

        {!loading && corrections.length === 0 ? (
          <Card>
            <Txt variant="body" tone="secondary">
              {t('settings.groups.app.naturalLanguageBeta.corrections.empty')}
            </Txt>
          </Card>
        ) : null}

        {loading ? null : (
          <Card>
            <View style={styles.corrections}>
              {corrections.map((correction, index) => {
                const key = normalizeCorrectionName(correction.original);
                const draft = drafts[key] ?? correction.corrected;
                const busy = busyKey === key;
                const canSave =
                  draft.trim().length > 0 && normalizeCorrectionName(draft) !== key && !busy;

                return (
                  <View
                    key={key}
                    style={[
                      styles.correction,
                      index < corrections.length - 1 && styles.correctionDivider,
                    ]}>
                    <Txt variant="caption" tone="secondary">
                      {t('settings.groups.app.naturalLanguageBeta.corrections.original', {
                        value: correction.original,
                      })}
                    </Txt>
                    <TextField
                      label={t('settings.groups.app.naturalLanguageBeta.corrections.corrected')}
                      value={draft}
                      onChangeText={(value) => updateDraft(correction, value)}
                      editable={!busy}
                    />
                    <View style={styles.actions}>
                      <Button
                        title={t('settings.groups.app.naturalLanguageBeta.corrections.save')}
                        size="sm"
                        style={styles.action}
                        onPress={() => void saveCorrection(correction)}
                        loading={busy}
                        disabled={!canSave}
                      />
                      <Button
                        title={t('settings.groups.app.naturalLanguageBeta.corrections.delete')}
                        variant="danger"
                        size="sm"
                        style={styles.action}
                        onPress={() => void deleteCorrection(correction)}
                        loading={busy}
                        disabled={busy}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}
