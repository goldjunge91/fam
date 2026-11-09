import { File } from 'expo-file-system';
import type { AssistantAttachment, AssistantAttachmentInput } from '../types';

const MAX_ATTACHMENT_BYTES = 5_500_000;
const MAX_TOTAL_ATTACHMENT_BYTES = 8_000_000;

export async function encodeAssistantAttachments(
  inputs: readonly AssistantAttachmentInput[],
): Promise<AssistantAttachment[]> {
  if (inputs.length === 0) return [];
  if (inputs.length > 5) throw new Error('Füge höchstens fünf Anhänge hinzu.');

  let totalEncodedCharacters = 0;
  let estimatedTotalEncodedCharacters = 0;
  const attachments: AssistantAttachment[] = [];
  for (const input of inputs) {
    const file = new File(input.uri);
    if (!file.exists) throw new Error('Der ausgewählte Anhang ist nicht mehr verfügbar.');
    const size = file.size ?? 0;
    const estimatedEncodedCharacters = Math.ceil(size / 3) * 4;
    estimatedTotalEncodedCharacters += estimatedEncodedCharacters;
    if (
      size <= 0 ||
      size > MAX_ATTACHMENT_BYTES ||
      estimatedTotalEncodedCharacters > MAX_TOTAL_ATTACHMENT_BYTES
    ) {
      throw new Error('Anhänge dürfen zusammen höchstens 8 MB groß sein.');
    }
    const data = await file.base64();
    totalEncodedCharacters += data.length;
    if (totalEncodedCharacters > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error('Anhänge dürfen zusammen höchstens 8 MB groß sein.');
    }
    attachments.push({
      filename: input.name.trim().slice(0, 100),
      mimeType: input.mimeType,
      data,
    });
  }
  return attachments;
}
