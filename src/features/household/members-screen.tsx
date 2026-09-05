import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
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

export function MembersScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
  const currentUserId = session?.user.id;

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
      {/* Button zum Wechseln oder Beitreten eines anderen Haushalts */}
      <View className="mb-two">
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

      {/* Admin-Aktionen: Einladen neuer Mitglieder & Kinder-Profile */}
      {isAdmin && currentHousehold && (
        <View className="flex-row gap-two mb-three">
          <View className="flex-1">
            <Button label="+ Mitglied einladen" onPress={() => setShowInviteModal(true)} />
          </View>
          <Button
            label="👶 Kinder-Profile"
            variant="secondary"
            onPress={() => router.push('/household/children')}
          />
        </View>
      )}

      {/* Liste aller Haushaltsmitglieder mit Rollenanzeige & Verwaltungsoptionen */}
      <FlashList
        style={{ flex: 1 }}
        data={members}
        keyExtractor={(item) => item.user_id}
        // FlashList positioniert Zeilen selbst, `gap` im Container greift nicht
        // — der Zeilenabstand kommt deshalb ueber einen Separator (#139).
        contentContainerStyle={{ paddingVertical: space.sm }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          const isMe = item.user_id === currentUserId;
          const displayName = item.display_name || 'Unbekanntes Mitglied';
          const initials = displayName.substring(0, 2).toUpperCase();

          return (
            /* Mitglieder-Zeile mit Avatar, Name, Rolle und Admin-Aktionen */
            <View className="member-row">
              <View
                className="member-avatar"
                style={{
                  backgroundColor: colors.backgroundElement,
                  borderColor: isMe ? colors.accent : undefined,
                  borderWidth: isMe ? 2 : undefined,
                }}>
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    accessibilityLabel={`Profilbild von ${displayName}`}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <Txt variant="body" weight="700">
                    {initials}
                  </Txt>
                )}
              </View>

              <View className="flex-1">
                <Txt variant="body" weight={isMe ? '700' : '400'}>
                  {displayName} {isMe ? '(Du)' : ''}
                </Txt>
                <Txt variant="body" tone="secondary">
                  Rolle: {item.role === 'admin' ? 'Administrator' : 'Mitglied'}
                </Txt>
              </View>

              {isAdmin && !isMe && (
                <View className="member-actions">
                  <Pressable
                    onPress={() => handleToggleRole(item.user_id, item.role, displayName)}
                    className="member-role-tag"
                    style={{ backgroundColor: withAlpha(colors.accent, 0.1) }}>
                    <Txt variant="caption" tone="primary">
                      {item.role === 'admin' ? 'Admin ▾' : 'Mitglied ▾'}
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveMember(item.user_id, displayName)}
                    className="member-remove-tag"
                    style={{ backgroundColor: withAlpha(colors.tomato, 0.1) }}>
                    <Txt variant="caption" tone="danger">
                      Entfernen
                    </Txt>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          !isLoading ? (
            /* Footer-Bereich: Kinder-Profile (Nicht-Admins), Verlassen & Löschen */
            <View className="mt-six">
              {!isAdmin && (
                <View className="mb-three">
                  <Button
                    label="👶 Kinder-Profile verwalten"
                    variant="secondary"
                    onPress={() => router.push('/household/children')}
                  />
                </View>
              )}

              {isAdmin ? (
                <View className="gap-two">
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
                    <Txt variant="caption" tone="secondary" center>
                      Ernenne zuerst einen weiteren Admin, um den Haushalt zu verlassen.
                    </Txt>
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

      {/* Modal zur Generierung von Einladungslinks / Codes */}
      {currentHousehold && (
        <InviteModal
          visible={showInviteModal}
          householdId={currentHousehold.id}
          householdName={currentHousehold.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Modal zum Wechseln des aktiven Haushalts */}
      <HouseholdSwitcherModal
        visible={showSwitcherModal}
        selectedHouseholdId={currentHousehold?.id}
        onClose={() => setShowSwitcherModal(false)}
      />
    </Screen>
  );
}
