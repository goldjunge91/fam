import { router, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { usePasswordRecoveryStore } from '@/features/auth/recovery-store';

/** Cancels the in-memory recovery session before leaving its route. */
export function usePasswordRecoveryCancellation() {
  const operation = usePasswordRecoveryStore((state) => state.operation);
  const hasRecoveryState = usePasswordRecoveryStore(
    (state) =>
      state.phase !== 'entry' ||
      state.email.length > 0 ||
      state.code.length > 0 ||
      state.operation !== null ||
      state.recoveryClient !== null,
  );
  const navigation = useNavigation();

  const cancel = useCallback(async () => {
    if (operation === 'saving') return;
    const cancelled = await usePasswordRecoveryStore.getState().cancel();
    if (!cancelled) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [operation]);

  usePreventRemove(
    hasRecoveryState,
    useCallback(
      ({ data }) => {
        if (usePasswordRecoveryStore.getState().operation === 'saving') return;
        const action = data.action;
        void usePasswordRecoveryStore
          .getState()
          .cancel()
          .then((cancelled) => {
            if (cancelled) navigation.dispatch(action);
          });
      },
      [navigation],
    ),
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        void cancel();
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [cancel]),
  );

  return { cancel, isSaving: operation === 'saving' };
}
