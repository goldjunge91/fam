import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { AccountProviderGate } from './account-provider-gate';

let mockAccountReady = false;
const mockActiveHouseholdProvider = jest.fn();
const mockPremiumProvider = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1' } },
    accountReady: mockAccountReady,
    error: mockAccountReady ? null : new Error('lokaler Bootstrap fehlgeschlagen'),
  }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  ActiveHouseholdProvider: ({ children }: { children: ReactNode }) => {
    mockActiveHouseholdProvider();
    return <>{children}</>;
  },
}));

jest.mock('@/features/premium/premium-provider', () => ({
  PremiumProvider: ({ children }: { children: ReactNode }) => {
    mockPremiumProvider();
    return <>{children}</>;
  },
}));

function GateProbe() {
  return <Text>Gate-Inhalt</Text>;
}

describe('AccountProviderGate', () => {
  beforeEach(() => {
    mockAccountReady = false;
    mockActiveHouseholdProvider.mockClear();
    mockPremiumProvider.mockClear();
  });

  it('mountet keine Account-Provider bei einem nicht bereiten Account', async () => {
    const view = await render(
      <AccountProviderGate>
        <GateProbe />
      </AccountProviderGate>,
    );

    expect(screen.getByText('Gate-Inhalt')).toBeOnTheScreen();
    expect(mockActiveHouseholdProvider).not.toHaveBeenCalled();
    expect(mockPremiumProvider).not.toHaveBeenCalled();

    mockAccountReady = true;
    await view.rerender(
      <AccountProviderGate>
        <GateProbe />
      </AccountProviderGate>,
    );

    expect(mockActiveHouseholdProvider).toHaveBeenCalledTimes(1);
    expect(mockPremiumProvider).toHaveBeenCalledTimes(1);
  });

  it('mountet die Account-Provider erst nach erfolgreichem Bootstrap', async () => {
    mockAccountReady = true;

    await render(
      <AccountProviderGate>
        <GateProbe />
      </AccountProviderGate>,
    );

    expect(screen.getByText('Gate-Inhalt')).toBeOnTheScreen();
    expect(mockActiveHouseholdProvider).toHaveBeenCalledTimes(1);
    expect(mockPremiumProvider).toHaveBeenCalledTimes(1);
  });
});
