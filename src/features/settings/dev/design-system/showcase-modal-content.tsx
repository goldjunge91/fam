import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';

export type ModalComparisonMode = 'input' | 'preview';

export type ModalComparisonContentProps = {
  mode: ModalComparisonMode;
  onDismiss: () => void;
  onOpenPreview?: () => void;
};

export function ModalComparisonHostedContent(props: ModalComparisonContentProps) {
  return (
    <View style={styles.hostedContent}>
      <ModalComparisonSheet {...props} />
    </View>
  );
}

export function ModalComparisonScrollContent(props: ModalComparisonContentProps) {
  return <ModalComparisonSheet {...props} />;
}

function ModalComparisonSheet({ mode, onDismiss, onOpenPreview }: ModalComparisonContentProps) {
  return (
    <Surface tone="surface" style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Txt variant="caption" tone="secondary">
            {mode === 'input' ? 'Einkaufsliste' : 'Neue Artikel'}
          </Txt>
          <Txt variant="title">{mode === 'input' ? 'Artikel sprechen' : 'Passt das so?'}</Txt>
        </View>
        <CloseButton onPress={onDismiss} hitSlop={6} accessibilityLabel="Schließen" />
      </View>

      <ScrollView
        testID={`design-system-natural-language-${mode}-scroll`}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ModalComparisonContent
            mode={mode}
            onDismiss={onDismiss}
            onOpenPreview={onOpenPreview}
          />
        </View>
      </ScrollView>
    </Surface>
  );
}

export function ModalComparisonContent({
  mode,
  onDismiss,
  onOpenPreview,
}: ModalComparisonContentProps) {
  const [inputText, setInputText] = useState('');
  const [draftText, setDraftText] = useState('3 Äpfel, Skyr von JA und Brot');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [deferred, setDeferred] = useState(false);

  return mode === 'input' ? (
    <InputContent
      value={inputText}
      onChangeText={setInputText}
      onOpenPreview={onOpenPreview}
      onDismiss={onDismiss}
    />
  ) : (
    <PreviewContent
      draftText={draftText}
      onDraftTextChange={setDraftText}
      selectedSuggestion={selectedSuggestion}
      deferred={deferred}
      onSelectSuggestion={(suggestion) => {
        setSelectedSuggestion(suggestion);
        setDeferred(false);
      }}
      onDefer={() => {
        setSelectedSuggestion(null);
        setDeferred(true);
      }}
      onDismiss={onDismiss}
    />
  );
}

function InputContent({
  value,
  onChangeText,
  onOpenPreview,
  onDismiss,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onOpenPreview?: () => void;
  onDismiss: () => void;
}) {
  const submit = () => {
    if (!value.trim()) return;
    onOpenPreview?.();
  };

  return (
    <>
      <Txt variant="body" tone="secondary">
        Nenne mehrere Artikel, zum Beispiel „3 Äpfel und Brot“.
      </Txt>

      <View style={styles.inputRoot}>
        <TextField
          label="Artikel hinzufügen"
          value={value}
          onChangeText={onChangeText}
          placeholder="z. B. 3 Äpfel und Brot"
          onSubmitEditing={submit}
          returnKeyType="done"
          accessibilityLabel="Artikel hinzufügen"
        />
        <Button
          title="Spracheingabe"
          accessibilityLabel="Spracheingabe"
          icon="mic"
          variant="secondary"
          flat
          onPress={() => onChangeText(value || '3 Äpfel und Brot')}
          full
        />
        <Button title="Artikel prüfen" onPress={submit} full disabled={!value.trim()} />
      </View>

      <Button title="Später" variant="secondary" onPress={onDismiss} full />
    </>
  );
}

function PreviewContent({
  draftText,
  onDraftTextChange,
  selectedSuggestion,
  deferred,
  onSelectSuggestion,
  onDefer,
  onDismiss,
}: {
  draftText: string;
  onDraftTextChange: (value: string) => void;
  selectedSuggestion: string | null;
  deferred: boolean;
  onSelectSuggestion: (suggestion: string) => void;
  onDefer: () => void;
  onDismiss: () => void;
}) {
  const selectedCount = selectedSuggestion ? 3 : 2;

  return (
    <>
      <View style={styles.transcript}>
        <TextField
          label="Erkannter Text"
          value={draftText}
          onChangeText={onDraftTextChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={styles.transcriptInput}
        />
        <Button
          title="Neu prüfen"
          variant="secondary"
          onPress={() => undefined}
          disabled={!draftText.trim()}
          full
        />
        <Txt variant="caption" tone="secondary">
          2 Treffer sicher, 1 Artikel braucht deine Zuordnung.
        </Txt>
      </View>

      <View style={styles.bundlePrompt}>
        <View style={styles.bundlePromptHeader}>
          <Txt variant="label">Ordne die offenen Artikel zu</Txt>
          <Txt variant="caption" tone="warning">
            1 offen
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          Wähle pro Artikel einen Treffer oder verschiebe ihn auf später.
        </Txt>
      </View>

      <View style={styles.rows}>
        <PreviewRow label="3 Äpfel" target="Obst" />
        <PreviewRow
          label="Skyr von JA"
          target={selectedSuggestion}
          uncertain
          deferred={deferred}
          onSelectSuggestion={onSelectSuggestion}
          onDefer={onDefer}
        />
        <PreviewRow label="Brot" target="Backwaren" />
      </View>

      <View style={styles.footer}>
        <Button title={`${selectedCount} Artikel hinzufügen`} onPress={onDismiss} full />
        <Button title="Später" variant="secondary" onPress={onDismiss} full />
      </View>
    </>
  );
}

function PreviewRow({
  label,
  target,
  uncertain = false,
  deferred = false,
  onSelectSuggestion,
  onDefer,
}: {
  label: string;
  target: string | null;
  uncertain?: boolean;
  deferred?: boolean;
  onSelectSuggestion?: (suggestion: string) => void;
  onDefer?: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemHeader}>
        <Txt variant="body" weight="600">
          {label}
        </Txt>
        <Txt variant="caption" tone={uncertain ? 'warning' : 'success'}>
          {uncertain ? '?' : '✓'}
        </Txt>
      </View>

      {uncertain ? (
        <View style={styles.suggestionList}>
          {['REWE', 'Aldi'].map((suggestion) => (
            <Press
              key={suggestion}
              selected={target === suggestion}
              onPress={() => onSelectSuggestion?.(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={suggestion}
              accessibilityState={{ selected: target === suggestion }}
              containerStyle={styles.choiceContainer}>
              <View style={styles.choice}>
                <Txt variant="caption" weight="600">
                  {suggestion}
                </Txt>
                {target === suggestion ? (
                  <Txt variant="caption" tone="accent">
                    ✓
                  </Txt>
                ) : null}
              </View>
            </Press>
          ))}
          <Press
            selected={deferred}
            onPress={onDefer}
            accessibilityRole="button"
            accessibilityLabel="Später zuordnen"
            accessibilityState={{ selected: deferred }}
            containerStyle={styles.choiceContainer}>
            <View style={[styles.choice, deferred && styles.deferredChoice]}>
              <Txt variant="caption" tone="secondary">
                Später zuordnen
              </Txt>
            </View>
          </Press>
        </View>
      ) : (
        <Txt variant="caption" tone="secondary">
          {target}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  hostedContent: {
    flexGrow: 1,
    height: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    flex: 1,
    width: '100%',
    minHeight: theme.space.xxxl * 6,
    backgroundColor: theme.backgroundElement,
  },
  content: {
    gap: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.lg,
  },
  headerCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  inputRoot: {
    gap: theme.space.sm,
  },
  transcript: {
    gap: theme.space.xs,
    borderLeftWidth: theme.borderWidth.strong,
    borderLeftColor: theme.accent,
    backgroundColor: theme.backgroundSoft,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
  },
  transcriptInput: {
    minHeight: theme.space.xxl * 3,
  },
  bundlePrompt: {
    gap: theme.space.xs,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.warning,
    backgroundColor: theme.backgroundSoft,
    padding: theme.space.md,
  },
  bundlePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  rows: {
    gap: theme.space.sm,
  },
  itemRow: {
    gap: theme.space.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
    padding: theme.space.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  suggestionList: {
    gap: theme.space.xs,
  },
  choiceContainer: {
    width: '100%',
  },
  choice: {
    minHeight: theme.space.xxl + theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  deferredChoice: {
    backgroundColor: theme.backgroundSoft,
    borderColor: theme.accent,
  },
  footer: {
    gap: theme.space.sm,
  },
}));
