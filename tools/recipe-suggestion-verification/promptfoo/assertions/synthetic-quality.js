import { assessSyntheticResponse } from '../../synthetic/quality.mjs';

export default function assertSyntheticQuality(output, context) {
  try {
    return assessSyntheticResponse(output,
      JSON.parse(context.vars.compact_context), JSON.parse(context.vars.expected));
  } catch {
    return { pass: false, score: 0, reason: 'Invalid synthetic scenario context or expectations' };
  }
}
