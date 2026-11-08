import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
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

const PROVIDER_OPTIONS = AI_PROVIDERS.map((provider) => ({
  value: provider,
  label: AI_PROVIDER_LABELS[provider],
}));

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.space.lg },
  modelInfo: { gap: theme.space.xs, paddingVertical: theme.space.md },
  resultText: { marginTop: theme.space.sm },
}));

export function AiModelTestScreen() {
  const hasAccess = useDevToolsAccess();
  const { activeHouseholdId } = useActiveHousehold();
  const provider = useDevSettingsStore((state) => state.aiProvider);
  const model = useDevSettingsStore((state) => state.aiModel);
  const setProvider = useDevSettingsStore((state) => state.setAiProvider);
  const setModel = useDevSettingsStore((state) => state.setAiModel);
  const [prompt, setPrompt] = useState(
    'Schlage ein schnelles Abendessen mit Kartoffeln und Linsen vor.',
  );
  const [modelIdDraft, setModelIdDraft] = useState(model);
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<AiModelTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setModelIdDraft(model), [model]);

  if (!hasAccess) return <Redirect href="/settings" />;

  const options = AI_MODEL_CATALOG[provider];
  const selectedModel = options.find((option) => option.id === model) ?? {
    id: model,
    label: model,
    description: 'Manuelle Modell-ID',
    supportsImages: null,
  };
  const providerLabel = AI_PROVIDER_LABELS[provider];
  const modelIdIsValid = isValidAiModelId(modelIdDraft.trim());

  async function runModelTest() {
    if (!activeHouseholdId) {
      setError('Wähle zuerst einen aktiven Haushalt aus.');
      setResult(null);
      return;
    }
    if (!prompt.trim()) {
      setError('Gib einen Testprompt ein.');
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
      setError(
        testError instanceof Error ? testError.message : 'Der Modelltest ist fehlgeschlagen.',
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Screen
      title="KI-Modell testen"
      subtitle="Die Auswahl gilt für lokale KI-Abläufe dieses Geräts."
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <View style={styles.content}>
        <ContentCard title="Provider">
          <SegmentedControl
            label="AI-Provider"
            options={PROVIDER_OPTIONS}
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

        <SettingsGroup title={`Modelle · ${providerLabel}`}>
          {options.map((option, index) => (
            <SettingsRow
              key={option.id}
              label={option.label}
              value={option.id === model ? 'Ausgewählt' : undefined}
              hint={`${option.id} · ${option.description}`}
              onPress={() => {
                setModel(option.id);
                setModelIdDraft(option.id);
                setResult(null);
                setError(null);
              }}
              last={index === options.length - 1}
            />
          ))}
        </SettingsGroup>

        <ContentCard title="Modell-ID">
          <View style={styles.modelInfo}>
            <Txt variant="caption" tone="secondary">
              Du kannst ein Katalogmodell antippen oder eine andere Modell-ID für {providerLabel}
              eintragen. Für eigene IDs muss das Modell in der lokalen AI-Gateway-Allowlist des
              Providers stehen.
            </Txt>
          </View>
          <TextField
            label={`${providerLabel} Modell-ID`}
            value={modelIdDraft}
            onChangeText={setModelIdDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="anbieter/modell-id"
            maxLength={160}
          />
          <Button
            title="Modell-ID übernehmen"
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
          <ContentCard title="Modellprompt testen">
            <View style={styles.modelInfo}>
              <Txt variant="caption" tone="secondary">
                Der Test nutzt keine Vorräte, Rezepte oder persönlichen Haushaltsdaten und belastet
                keine AI-Credits. Die Anfrage ist auf die lokale Supabase-Instanz beschränkt.
              </Txt>
              <Txt variant="caption" tone="secondary">
                PDF- und Videoimporte sowie Quellen, die das gewählte Modell nicht unterstützt,
                werden über das multimodale OpenRouter-Fallback verarbeitet.
              </Txt>
              {selectedModel.supportsImages === false ? (
                <Txt variant="caption" tone="secondary">
                  Dieses Modell verarbeitet Text. Bildimporte verwenden das multimodale
                  OpenRouter-Fallback.
                </Txt>
              ) : null}
            </View>
            <TextField
              label="Testprompt"
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={2_000}
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Button
              title={isTesting ? 'Modell wird getestet …' : `${selectedModel.label} testen`}
              onPress={() => void runModelTest()}
              disabled={isTesting || prompt.trim().length === 0 || modelIdDraft.trim() !== model}
              loading={isTesting}
              full
            />
          </ContentCard>
        ) : null}

        {error ? (
          <ContentCard title="Modelltest fehlgeschlagen">
            <Txt variant="body" tone="danger">
              {error}
            </Txt>
          </ContentCard>
        ) : null}

        {result ? (
          <ContentCard
            title={`${result.provider === 'groq' ? 'Groq' : 'OpenRouter'} · ${result.model}`}>
            <Txt variant="caption" tone="secondary">
              {`${result.durationMs} ms${result.usage?.total_tokens === undefined ? '' : ` · ${result.usage.total_tokens} Tokens`}`}
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
