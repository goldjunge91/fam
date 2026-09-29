import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Row, TextField } from '@/constants/ui';
import type { ReceiptOcrProvider, ReceiptOcrResult } from '@/features/ocr/processing/native';
import type { InspectorReceiptGeometry } from './ocr-inspector-geometry';
import { type ManualLabelSelection, manualLabelText } from './ocr-inspector-manual-labels';
import type { InspectorImageSettings } from './ocr-inspector-pipeline';

type InspectorRunSettings = InspectorImageSettings & { iosProvider: ReceiptOcrProvider };

type OcrInspectorOutputActionsProps = {
  result: ReceiptOcrResult | null;
  text: string;
  runSettings: InspectorRunSettings | null;
  manualLabels: ManualLabelSelection;
  geometry: InspectorReceiptGeometry | null;
};

const styles = StyleSheet.create({
  jsonOutput: {
    height: 220,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
});

export function OcrInspectorOutputActions({
  result,
  text,
  runSettings,
  manualLabels,
  geometry,
}: OcrInspectorOutputActionsProps) {
  const [showJson, setShowJson] = useState(false);
  const json =
    result && runSettings
      ? JSON.stringify(
          {
            provider: runSettings.iosProvider,
            imageSettings: {
              resize: runSettings.resize,
              crop: runSettings.crop,
              colorMode: runSettings.colorMode,
              contrast: runSettings.contrast,
              sharpen: runSettings.sharpen,
              quality: runSettings.quality,
              brightness: runSettings.brightness,
              threshold: runSettings.threshold,
            },
            imageSize: result.imageSize,
            receiptGeometry: geometry,
            lines: result.lines,
            manualLabels: {
              article: {
                lineIndexes: manualLabels.article,
                text: manualLabelText(result.lines, manualLabels.article),
              },
              quantity: {
                lineIndexes: manualLabels.quantity,
                text: manualLabelText(result.lines, manualLabels.quantity),
              },
              unitPrice: {
                lineIndexes: manualLabels.unitPrice,
                text: manualLabelText(result.lines, manualLabels.unitPrice),
              },
              price: {
                lineIndexes: manualLabels.price,
                text: manualLabelText(result.lines, manualLabels.price),
              },
            },
          },
          null,
          2,
        )
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
          disabled={!json}
          onPress={() => void Clipboard.setStringAsync(json)}
        />
        <Button
          title={showJson ? 'JSON ausblenden' : 'JSON anzeigen'}
          variant="link"
          size="sm"
          disabled={!json}
          onPress={() => setShowJson((current) => !current)}
        />
      </Row>
      {showJson && json ? (
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
