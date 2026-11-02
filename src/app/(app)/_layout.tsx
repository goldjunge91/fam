import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import AppShell from '@/components/layout/app-shell';
import { CrashFallback } from '@/features/app-shell/crash-fallback';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/features/auth/pending-invite';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useRedeemInviteMutation } from '@/features/household/api';
import { retryPendingReceiptAssetUpload } from '@/features/ocr/capture/api';
import { useAppEntryReadiness } from '@/features/onboarding/app-entry-readiness';
import {
  isOnboardingSessionCompleted,
  persistOnboardingCompleted,
} from '@/features/onboarding/onboarding-completion';
import { WatchShoppingToggleListener } from '@/features/shopping-list/watch/watch-toggle-listener';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugError } from '@/lib/observability/debug-log';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';
import { subscribeHouseholdMembershipRealtime } from '@/lib/sync/household-membership-realtime';
import { useRealtimeSync, useSyncEngine } from '@/lib/sync/sync-runner';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function AppLayoutContent() {
  const { session, seenOnboarding } = useSession();
  const userId = session?.user.id;
  const { decision, retry: retryRouting } = useAppEntryReadiness();
  const queryClient = useQueryClient();
  const { activeHouseholdId } = useActiveHousehold();

  useEffect(() => {
    if (!userId) return;
    return subscribeHouseholdMembershipRealtime(getSupabase(), userId, () => {
      void triggerHouseholdsPull(userId, queryClient);
    });
  }, [queryClient, userId]);

  // Ein vollständiger App-Zustand gilt als eingerichtet; das Geräte-Flag wird nachgetragen.
  const istEingerichtet = decision.kind === 'weiter';
  useEffect(() => {
    if (istEingerichtet && !seenOnboarding && !isOnboardingSessionCompleted()) {
      persistOnboardingCompleted();
    }
  }, [istEingerichtet, seenOnboarding]);

  if (decision.kind === 'umleiten') {
    return <Redirect href={decision.to} />;
  }

  if (decision.kind === 'warten') {
    return (
      <View
        accessible
        accessibilityLabel="Start wird vorbereitet"
        accessibilityRole="progressbar"
        style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (decision.kind === 'fehler') {
    return <CrashFallback resetError={retryRouting} />;
  }

  return <ReadyAppContent activeHouseholdId={activeHouseholdId} accountId={userId ?? null} />;
}

function ReadyAppContent({
  activeHouseholdId,
  accountId,
}: {
  activeHouseholdId: string | null;
  accountId: string | null;
}) {
  const redeemInvite = useRedeemInviteMutation();
  const retryReceiptAssets = useCallback(async () => {
    if (!activeHouseholdId || !accountId) return;
    await retryPendingReceiptAssetUpload({
      accountId,
      householdId: activeHouseholdId,
      createdBy: accountId,
    });
  }, [accountId, activeHouseholdId]);

  // Automatische App-Synchronisation startet erst nach der Routingentscheidung.
  useSyncEngine(activeHouseholdId ?? undefined, retryReceiptAssets);
  useRealtimeSync(activeHouseholdId ?? undefined, retryReceiptAssets);

  useEffect(() => {
    peekPendingInviteToken().then(async (pendingToken) => {
      if (pendingToken) {
        try {
          await redeemInvite.mutateAsync(pendingToken);
          await clearPendingInviteToken();
          router.replace('/');
        } catch (err) {
          debugError('Automatische Einloesung fehlgeschlagen:', err);
        }
      }
    });
  }, [redeemInvite]);

  return (
    <View style={styles.root}>
      <WatchShoppingToggleListener activeHouseholdId={activeHouseholdId} accountId={accountId} />
      <AppShell />
    </View>
  );
}

/** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
export default function AppLayout() {
  return <AppLayoutContent />;
}
