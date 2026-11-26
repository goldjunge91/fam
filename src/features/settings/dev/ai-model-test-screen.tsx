import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { Button, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { type AiModelTestResult, testAiModel } from '@/features/ai-assistant/data/assistant-api';
import {
  AI_MODEL_CATALOG,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiProvider,
  isValidAiModelId,
} from '@/features/ai-assistant/model-catalog';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';

const MODEL_COPY_KEYS = {
  'z-ai/glm-5.3-flash': ['dev.ai.models.glm53Flash.label', 'dev.ai.models.glm53Flash.description'],
  'qwen/qwen3.8-flash': [
    'dev.ai.models.qwen38Flash.label',
    'dev.ai.models.qwen38Flash.description',
  ],
  'google/gemma-4-26b-a4b-it': [
    'dev.ai.models.gemma426.label',
    'dev.ai.models.gemma426.description',
  ],
  'google/gemma-4-31b-it': ['dev.ai.models.gemma431.label', 'dev.ai.models.gemma431.description'],
  'ibm-granite/granite-4.2-8b': [
    'dev.ai.models.granite42.label',
    'dev.ai.models.granite42.description',
  ],
  'minimax/minimax-m3:free': [
    'dev.ai.models.minimaxM3.label',
    'dev.ai.models.minimaxM3.description',
  ],
  'qwen/qwen3.8-27b': ['dev.ai.models.qwen3827.label', 'dev.ai.models.qwen3827.description'],
  'openai/gpt-oss-120b': ['dev.ai.models.gptOss120.label', 'dev.ai.models.gptOss120.description'],
  'openai/gpt-oss-20b': ['dev.ai.models.gptOss20.label', 'dev.ai.models.gptOss20.description'],
  'openai/gpt-oss-safeguard-20b': [
    'dev.ai.models.gptOssSafeguard.label',
    'dev.ai.models.gptOssSafeguard.description',
  ],
  'meta-llama/llama-prompt-guard-2-22m': [
    'dev.ai.models.promptGuard22.label',
    'dev.ai.models.promptGuard22.description',
  ],
  'meta-llama/llama-prompt-guard-2-86m': [
    'dev.ai.models.promptGuard86.label',
    'dev.ai.models.promptGuard86.description',
  ],
} as const;

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.space.lg },
  modelInfo: { gap: theme.space.xs, paddingVertical: theme.space.md },
  resultText: { marginTop: theme.space.sm },
}));

export function AiModelTestScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const { activeHouseholdId } = useActiveHousehold();
  const provider = useDevSettingsStore((state) => state.aiProvider);
  const model = useDevSettingsStore((state) => state.aiModel);
  const setProvider = useDevSettingsStore((state) => state.setAiProvider);
  const setModel = useDevSettingsStore((state) => state.setAiModel);
  const [prompt, setPrompt] = useState(t('dev.ai.promptDefault'));
  const [modelIdDraft, setModelIdDraft] = useState(model);
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<AiModelTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setModelIdDraft(model), [model]);

  if (!hasAccess) return <Redirect href="/settings" />;

  const options = AI_MODEL_CATALOG[provider];
  const selectedModelOption = options.find((option) => option.id === model);
  const selectedModelCopy = selectedModelOption
    ? MODEL_COPY_KEYS[selectedModelOption.id as keyof typeof MODEL_COPY_KEYS]
    : undefined;
  const selectedModel = selectedModelOption
    ? {
        id: selectedModelOption.id,
        label: selectedModelCopy ? t(selectedModelCopy[0]) : selectedModelOption.label,
        description: selectedModelCopy ? t(selectedModelCopy[1]) : selectedModelOption.description,
        supportsImages: selectedModelOption.supportsImages,
      }
    : {
        id: model,
        label: model,
        description: t('dev.ai.manualModel'),
        supportsImages: null,
      };
  const providerLabel = AI_PROVIDER_LABELS[provider];
  const modelIdIsValid = isValidAiModelId(modelIdDraft.trim());

  async function runModelTest() {
    if (!activeHouseholdId) {
      setError(t('dev.ai.noHousehold'));
      setResult(null);
      return;
    }
    if (!prompt.trim()) {
      setError(t('dev.ai.emptyPrompt'));
      setResult(null);
      return;
    }
    setIsTesting(true);
    setError(null);
    setResult(null);
    try {
      const nextResult = await testAiModel({
        householdId: activeHouseholdId,
        provider,
        model,
        prompt: prompt.trim(),
      });
      setResult(nextResult);
    } catch (testError: unknown) {
      setError(testError instanceof Error ? testError.message : t('dev.ai.error'));
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Screen
      title={t('dev.ai.title')}
      subtitle={t('dev.ai.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <View style={styles.content}>
        <ContentCard title={t('dev.ai.providerCard')}>
          <SegmentedControl
            label={t('dev.ai.providerLabel')}
            options={AI_PROVIDERS.map((nextProvider) => ({
              value: nextProvider,
              label: AI_PROVIDER_LABELS[nextProvider],
            }))}
            selected={provider}
            onSelect={(nextProvider) => {
              setProvider(nextProvider as AiProvider);
              setResult(null);
              setError(null);
            }}
            appearance="surface"
            size="compact"
          />
        </ContentCard>

        <SettingsGroup title={t('dev.ai.modelsTitle', { provider: providerLabel })}>
          {options.map((option, index) => {
            const modelCopy = MODEL_COPY_KEYS[option.id as keyof typeof MODEL_COPY_KEYS];
            return (
              <SettingsRow
                key={option.id}
                label={modelCopy ? t(modelCopy[0]) : option.label}
                value={option.id === model ? t('dev.ai.selected') : undefined}
                hint={`${option.id} · ${modelCopy ? t(modelCopy[1]) : option.description}`}
                onPress={() => {
                  setModel(option.id);
                  setModelIdDraft(option.id);
                  setResult(null);
                  setError(null);
                }}
                last={index === options.length - 1}
              />
            );
          })}
        </SettingsGroup>

        <ContentCard title={t('dev.ai.modelIdCard')}>
          <View style={styles.modelInfo}>
            <Txt variant="caption" tone="secondary">
              {t('dev.ai.modelIdHint', { provider: providerLabel })}
            </Txt>
          </View>
          <TextField
            label={t('dev.ai.modelIdLabel', { provider: providerLabel })}
            value={modelIdDraft}
            onChangeText={setModelIdDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('dev.ai.modelIdPlaceholder')}
            maxLength={160}
          />
          <Button
            title={t('dev.ai.applyModelId')}
            onPress={() => {
              setModel(modelIdDraft.trim());
              setResult(null);
              setError(null);
            }}
            disabled={!modelIdIsValid || modelIdDraft.trim() === model}
            full
          />
        </ContentCard>

        {selectedModel ? (
          <ContentCard title={t('dev.ai.promptCard')}>
            <View style={styles.modelInfo}>
              <Txt variant="caption" tone="secondary">
                {t('dev.ai.promptHint')}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {t('dev.ai.fallbackHint')}
              </Txt>
              {selectedModel.supportsImages === false ? (
                <Txt variant="caption" tone="secondary">
                  {t('dev.ai.textOnlyHint')}
                </Txt>
              ) : null}
            </View>
            <TextField
              label={t('dev.ai.promptLabel')}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={2_000}
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Button
              title={
                isTesting
                  ? t('dev.ai.testing')
                  : t('dev.ai.testModel', { model: selectedModel.label })
              }
              onPress={() => void runModelTest()}
              disabled={isTesting || prompt.trim().length === 0 || modelIdDraft.trim() !== model}
              loading={isTesting}
              full
            />
          </ContentCard>
        ) : null}

        {error ? (
          <ContentCard title={t('dev.ai.failed')}>
            <Txt variant="body" tone="danger">
              {error}
            </Txt>
          </ContentCard>
        ) : null}

        {result ? (
          <ContentCard
            title={t('dev.ai.resultTitle', {
              provider: AI_PROVIDER_LABELS[result.provider],
              model: result.model,
            })}>
            <Txt variant="caption" tone="secondary">
              {result.usage?.total_tokens === undefined
                ? t('dev.ai.duration', { duration: result.durationMs })
                : t('dev.ai.durationWithTokens', {
                    duration: result.durationMs,
                    tokens: result.usage.total_tokens,
                  })}
            </Txt>
            <Txt variant="body" style={styles.resultText}>
              {result.text}
            </Txt>
          </ContentCard>
        ) : null}
      </View>
    </Screen>
  );
}
