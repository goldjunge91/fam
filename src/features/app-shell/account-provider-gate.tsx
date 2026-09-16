import type { ReactNode } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { ActiveHouseholdProvider } from '@/features/household/active-household-provider';
import { PremiumProvider } from '@/features/premium/premium-provider';

/** Mountet accountgebundene Provider erst nach einem vollständig committeden Bootstrap. */
export function AccountProviderGate({ children }: { children: ReactNode }): ReactNode {
  const { accountReady } = useSession();

  if (!accountReady) return children;

  return (
    <ActiveHouseholdProvider>
      <PremiumProvider>{children}</PremiumProvider>
    </ActiveHouseholdProvider>
  );
}
