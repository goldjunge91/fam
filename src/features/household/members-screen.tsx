import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useDeleteHouseholdMutation,
  useHouseholdMembers,
  useLeaveHouseholdMutation,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from '@/features/household/api';
import { isHouseholdAdmin } from '@/features/household/household-helpers';
import { HouseholdSwitcherModal } from '@/features/household/household-switcher-modal';
import { InviteModal } from '@/features/household/invite-modal';
import { useTheme } from '@/hooks/use-theme';

export function MembersScreen() {
  const { session } = useSession();
  const currentUserId = session?.user.id;
  const theme = useTheme();

  const { activeHousehold, activeHouseholdId, households } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const householdId = activeHouseholdId ?? '';

  const { data: members, isLoading } = useHouseholdMembers(householdId);
  const updateRoleMutation = useUpdateMemberRoleMutation();
  const removeMemberMutation = useRemoveMemberMutation();
  const leaveMutation = useLeaveHouseholdMutation();
  const deleteMutation = useDeleteHouseholdMutation();

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);

  const myMembership = members?.find((m) => m.user_id === currentUserId);
  const isAdmin = isHouseholdAdmin(myMembership?.role);
  const adminCount = members?.filter((m) => m.role === 'admin').length ?? 0;

  async function handleToggleRole(userId: string, currentRole: string, name: string) {
    if (!isAdmin || !householdId) return;
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText =
      newRole === 'admin' ? 'zum Administrator ernennen' : 'die Admin-Rolle entziehen';

    Alert.alert('Rolle ändern', `Möchtest du "${name}" ${actionText}?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Bestätigen',
        onPress: async () => {
          try {
            await updateRoleMutation.mutateAsync({
              householdId,
              userId,
              role: newRole,
            });
          } catch (err) {
            Alert.alert(
              'Fehler',
              err instanceof Error ? err.message : 'Fehler beim Ändern der Rolle',
            );
          }
        },
      },
    ]);
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!isAdmin || !householdId) return;
    Alert.alert(
      'Mitglied entfernen',
      `Möchtest du "${name}" wirklich aus dem Haushalt entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMemberMutation.mutateAsync({ householdId, userId });
            } catch (err) {
              Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Entfernen');
            }
          },
        },
      ],
    );
  }

  async function handleLeave() {
    if (!householdId) return;
    if (isAdmin && adminCount <= 1) {
      Alert.alert(
        'Haushalt verlassen nicht möglich',
        'Du bist der einzige Administrator dieses Haushalts. Ernenne zuerst ein anderes Mitglied zum Admin, bevor du den Haushalt verlässt.',
      );
      return;
    }

    Alert.alert('Haushalt verlassen', 'Möchtest du den Haushalt wirklich verlassen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verlassen',
        style: 'destructive',
        onPress: async () => {
          setLoadingAction('leave');
          try {
            await leaveMutation.mutateAsync(householdId);
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
    if (!householdId) return;
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
              await deleteMutation.mutateAsync(householdId);
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
    <Screen
      title="Mitglieder"
      subtitle={currentHousehold?.name}
      scroll={false}
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <View style={{ marginBottom: Spacing.two }}>
        <Button
          label={
            households.length > 1
              ? `🏠 Haushalt wechseln (${currentHousehold?.name ?? ''})`
              : '🏠 Haushalt wechseln / beitreten'
          }
          variant="secondary"
          onPress={() => setShowSwitcherModal(true)}
        />
      </View>

      {isAdmin && currentHousehold && (
        <View style={styles.topActionRow}>
          <View style={{ flex: 1 }}>
            <Button label="+ Mitglied einladen" onPress={() => setShowInviteModal(true)} />
          </View>
          <Button
            label="👶 Kinder-Profile"
            variant="secondary"
            onPress={() => router.push('/household/children')}
          />
        </View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={members}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMe = item.user_id === currentUserId;
          const displayName = item.display_name || 'Unbekanntes Mitglied';
          const initials = displayName.substring(0, 2).toUpperCase();

          return (
            <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.backgroundElement },
                  isMe && { borderColor: theme.accent, borderWidth: 2 },
                ]}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <ThemedText style={styles.avatarText}>{initials}</ThemedText>
                )}
              </View>

              <View style={styles.memberInfo}>
                <ThemedText style={{ fontWeight: isMe ? 'bold' : 'normal' }}>
                  {displayName} {isMe ? '(Du)' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Rolle: {item.role === 'admin' ? 'Administrator' : 'Mitglied'}
                </ThemedText>
              </View>

              {isAdmin && !isMe && (
                <View style={styles.memberActions}>
                  <Pressable
                    onPress={() => handleToggleRole(item.user_id, item.role, displayName)}
                    style={styles.roleTag}>
                    <ThemedText type="small" style={{ color: theme.accent, ...FontSize[12] }}>
                      {item.role === 'admin' ? 'Admin ▾' : 'Mitglied ▾'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveMember(item.user_id, displayName)}
                    style={styles.removeTag}>
                    <ThemedText type="small" style={{ color: theme.danger, ...FontSize[12] }}>
                      Entfernen
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          !isLoading ? (
            <View style={styles.actions}>
              {!isAdmin && (
                <View style={{ marginBottom: Spacing.three }}>
                  <Button
                    label="👶 Kinder-Profile verwalten"
                    variant="secondary"
                    onPress={() => router.push('/household/children')}
                  />
                </View>
              )}

              {isAdmin ? (
                <View style={{ gap: Spacing.two }}>
                  <Button
                    label="Haushalt verlassen"
                    variant="danger"
                    onPress={handleLeave}
                    loading={loadingAction === 'leave'}
                    disabled={
                      adminCount <= 1 || (loadingAction !== null && loadingAction !== 'leave')
                    }
                  />
                  {adminCount <= 1 && (
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={{ textAlign: 'center', ...FontSize[12] }}>
                      Ernenne zuerst einen weiteren Admin, um den Haushalt zu verlassen.
                    </ThemedText>
                  )}
                  <Button
                    label="Haushalt löschen"
                    variant="danger"
                    onPress={handleDelete}
                    loading={loadingAction === 'delete'}
                    disabled={loadingAction !== null && loadingAction !== 'delete'}
                  />
                </View>
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

      {currentHousehold && (
        <InviteModal
          visible={showInviteModal}
          householdId={currentHousehold.id}
          householdName={currentHousehold.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      <HouseholdSwitcherModal
        visible={showSwitcherModal}
        selectedHouseholdId={currentHousehold?.id}
        onClose={() => setShowSwitcherModal(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  list: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  memberRow: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: Radius.sheet,
  },
  avatarText: {
    fontWeight: 'bold',
    ...FontSize[14],
  },
  memberInfo: {
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  removeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  actions: {
    marginTop: Spacing.six,
  },
});
