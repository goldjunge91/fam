import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Row, TextField } from '@/constants/ui';
import type { ReceiptOcrResult } from '@/features/ocr/processing/native';

type OcrInspectorOutputActionsProps = {
  result: ReceiptOcrResult | null;
  text: string;
};

const styles = StyleSheet.create({
  jsonOutput: {
    height: 220,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
});

export function OcrInspectorOutputActions({ result, text }: OcrInspectorOutputActionsProps) {
  const [showJson, setShowJson] = useState(false);
  const json = result
    ? JSON.stringify({ imageSize: result.imageSize, lines: result.lines }, null, 2)
    : '';

  return (
    <View>
      <Row gap={8} wrap>
        <Button
          title="Kopieren"
          variant="link"
          size="sm"
          disabled={!text}
          onPress={() => void Clipboard.setStringAsync(text)}
        />
        <Button
          title="JSON kopieren"
          variant="link"
          size="sm"
          disabled={!result}
          onPress={() => void Clipboard.setStringAsync(json)}
        />
        <Button
          title={showJson ? 'JSON ausblenden' : 'JSON anzeigen'}
          variant="link"
          size="sm"
          disabled={!result}
          onPress={() => setShowJson((current) => !current)}
        />
      </Row>
      {showJson && result ? (
        <TextField
          accessibilityLabel="OCR-Ergebnis als JSON"
          value={json}
          editable={false}
          multiline
          style={styles.jsonOutput}
        />
      ) : null}
    </View>
  );
}
