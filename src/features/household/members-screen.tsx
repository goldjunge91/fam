import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  useDeleteHouseholdMutation,
  useHouseholdMembers,
  useHouseholds,
  useLeaveHouseholdMutation,
} from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';

export function MembersScreen() {
  const { session } = useSession();
  const currentUserId = session?.user.id;
  const theme = useTheme();

  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];

  const { data: members, isLoading } = useHouseholdMembers(currentHousehold?.id ?? '');
  const leaveMutation = useLeaveHouseholdMutation();
  const deleteMutation = useDeleteHouseholdMutation();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Finde die eigene Mitgliedschaft, um zu prüfen, ob der aktuelle Nutzer Admin ist.
  const myMembership = members?.find((m) => m.user_id === currentUserId);
  const isAdmin = myMembership?.role === 'admin';

  async function handleLeave() {
    if (!currentHousehold) return;
    Alert.alert('Haushalt verlassen', 'Möchtest du den Haushalt wirklich verlassen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verlassen',
        style: 'destructive',
        onPress: async () => {
          setLoadingAction('leave');
          try {
            await leaveMutation.mutateAsync(currentHousehold.id);
            router.replace('/');
          } catch (err: unknown) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler');
          } finally {
            setLoadingAction(null);
          }
        },
      },
    ]);
  }

  async function handleDelete() {
    if (!currentHousehold) return;
    Alert.alert(
      'Haushalt löschen',
      'Dieser Schritt löscht den kompletten Haushalt für alle Mitglieder und kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('delete');
            try {
              await deleteMutation.mutateAsync(currentHousehold.id);
              router.replace('/');
            } catch (err: unknown) {
              Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen title="Mitglieder" subtitle={currentHousehold?.name}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMe = item.user_id === currentUserId;
          // Supabase liefert den gejointen Datensatz im angegebenen Alias
          const profile = item.profiles as unknown as { display_name: string | null };
          const displayName = profile?.display_name || 'Unbekanntes Mitglied';

          return (
            <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
              <View style={styles.memberInfo}>
                <ThemedText style={{ fontWeight: isMe ? 'bold' : 'normal' }}>
                  {displayName} {isMe ? '(Du)' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Rolle: {item.role}
                </ThemedText>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          !isLoading ? (
            <View style={styles.actions}>
              {isAdmin ? (
                <Button
                  label="Haushalt löschen"
                  variant="danger"
                  onPress={handleDelete}
                  loading={loadingAction === 'delete'}
                  disabled={loadingAction !== null && loadingAction !== 'delete'}
                />
              ) : (
                <Button
                  label="Haushalt verlassen"
                  variant="danger"
                  onPress={handleLeave}
                  loading={loadingAction === 'leave'}
                  disabled={loadingAction !== null && loadingAction !== 'leave'}
                />
              )}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  memberRow: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberInfo: {
    flex: 1,
  },
  actions: {
    marginTop: Spacing.six,
  },
});
