import { useLocalSearchParams } from 'expo-router';

import { PlusAndAiScreen } from '@/features/premium/plus-and-ai-screen';
import type { PaywallTier } from '@/features/premium/types';

export default function PlusAndAiRoute() {
  const { tier } = useLocalSearchParams<{ tier?: string }>();
  const initialTier: PaywallTier = tier === 'ai' ? 'ai' : 'plus';
  return <PlusAndAiScreen initialTier={initialTier} />;
}
