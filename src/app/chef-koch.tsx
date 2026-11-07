import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { ChefKochScreen } from '@/features/chef-koch/screens/chef-koch-screen';

const conversationIdSchema = z.uuid();

export default function ChefKochRoute() {
  const { continuedFromConversationId } = useLocalSearchParams<{
    continuedFromConversationId?: string | string[];
  }>();
  const parsed = conversationIdSchema.safeParse(
    typeof continuedFromConversationId === 'string' ? continuedFromConversationId : undefined,
  );

  return <ChefKochScreen continuedFromConversationId={parsed.success ? parsed.data : undefined} />;
}
