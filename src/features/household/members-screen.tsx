import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { withAlpha } from '@/components/theme/index';
import { Button, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useDeleteHouseholdMutation,
  useHouseholdMembers,
  useLeaveHouseholdMutation,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from '@/features/household/api';
import { canAdminLeaveHousehold, isHouseholdAdmin } from '@/features/household/household-helpers';
import { HouseholdSwitcherModal } from '@/features/household/household-switcher-modal';
import { InviteModal } from '@/features/household/invite-modal';
import { AvatarImage } from '@/features/profile/avatar-image';

const styles = StyleSheet.create((theme) => ({
  switcher: {
    marginBottom: theme.space.sm,
  },
  adminActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginBottom: theme.space.lg,
  },
  flex: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: theme.space.sm,
  },
  separator: {
    height: theme.space.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.backgroundElement,
  },
  avatarSelected: {
    borderColor: theme.accent,
    borderWidth: theme.borderWidth.strong,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  memberCopy: {
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
    alignItems: 'center',
  },
  roleTag: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: withAlpha(theme.accent, 0.1),
  },
  removeTag: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: withAlpha(theme.danger, 0.1),
  },
  footer: {
    marginTop: theme.space.xxxl,
  },
  footerButton: {
    marginBottom: theme.space.lg,
  },
  destructiveActions: {
    gap: theme.space.sm,
  },
}));

export function MembersScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
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
  const canAdminLeave = canAdminLeaveHousehold(members ?? []);

  async function handleToggleRole(userId: string, currentRole: string, name: string) {
    if (!isAdmin || !householdId) return;
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText =
      newRole === 'admin' ? t('household.members.promote') : t('household.members.demote');

    Alert.alert(
      t('household.members.roleChange'),
      t('household.members.roleChangeConfirm', { name, action: actionText }),
      [
        { text: t('common.actions.cancel'), style: 'cancel' },
        {
          text: t('common.actions.confirm'),
          onPress: async () => {
            try {
              await updateRoleMutation.mutateAsync({
                householdId,
                userId,
                role: newRole,
              });
            } catch (err) {
              Alert.alert(
                t('common.errors.generic'),
                err instanceof Error ? err.message : t('common.errors.generic'),
              );
            }
          },
        },
      ],
    );
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!isAdmin || !householdId) return;
    Alert.alert(t('household.members.remove'), t('household.members.removeConfirm', { name }), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('common.actions.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberMutation.mutateAsync({ householdId, userId });
          } catch (err) {
            Alert.alert(
              t('common.errors.generic'),
              err instanceof Error ? err.message : t('common.errors.generic'),
            );
          }
        },
      },
    ]);
  }

  async function handleLeave() {
    if (!householdId) return;
    if (isAdmin && !canAdminLeave) {
      Alert.alert(
        t('household.members.leaveNotPossibleTitle'),
        t('household.members.leaveNotPossibleBody'),
      );
      return;
    }

    Alert.alert(t('household.members.leave'), t('household.members.leaveConfirm'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('household.members.leaveAction'),
        style: 'destructive',
        onPress: async () => {
          setLoadingAction('leave');
          try {
            await leaveMutation.mutateAsync(householdId);
            router.replace('/');
          } catch (err: unknown) {
            Alert.alert(
              t('common.errors.generic'),
              err instanceof Error ? err.message : t('common.errors.generic'),
            );
          } finally {
            setLoadingAction(null);
          }
        },
      },
    ]);
  }

  async function handleDelete() {
    if (!householdId) return;
    Alert.alert(t('household.members.delete'), t('household.members.deleteConfirm'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('household.members.delete'),
        style: 'destructive',
        onPress: async () => {
          setLoadingAction('delete');
          try {
            await deleteMutation.mutateAsync(householdId);
            router.replace('/');
          } catch (err: unknown) {
            Alert.alert(
              t('common.errors.generic'),
              err instanceof Error ? err.message : t('common.errors.generic'),
            );
          } finally {
            setLoadingAction(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen
      title={t('household.members.title')}
      subtitle={currentHousehold?.name}
      scroll={false}
      back={{ label: t('household.members.backToSettings'), href: '/settings' }}
      backStyle="icon">
      {/* Button zum Wechseln oder Beitreten eines anderen Haushalts */}
      <View style={styles.switcher}>
        <Button
          title={
            households.length > 1
              ? t('household.members.switcherMultiple', {
                  name: currentHousehold?.name ?? '',
                })
              : t('household.members.switcherJoin')
          }
          variant="secondary"
          onPress={() => setShowSwitcherModal(true)}
        />
      </View>

      {/* Admin-Aktionen: Einladen neuer Mitglieder & Kinder-Profile */}
      {isAdmin && currentHousehold && (
        <View style={styles.adminActions}>
          <View style={styles.flex}>
            <Button
              title={t('household.members.invite')}
              onPress={() => setShowInviteModal(true)}
            />
          </View>
          <Button
            title={t('household.members.children')}
            variant="secondary"
            onPress={() => router.push('/household/children')}
          />
        </View>
      )}

      {/* Liste aller Haushaltsmitglieder mit Rollenanzeige & Verwaltungsoptionen */}
      <FlashList
        style={styles.list}
        data={members}
        keyExtractor={(item) => item.user_id}
        // FlashList positioniert Zeilen selbst, `gap` im Container greift nicht
        // — der Zeilenabstand kommt deshalb ueber einen Separator (#139).
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const isMe = item.user_id === currentUserId;
          const displayName = item.display_name || t('household.members.unknownMember');
          const initials = displayName.substring(0, 2).toUpperCase();

          return (
            /* Mitglieder-Zeile mit Avatar, Name, Rolle und Admin-Aktionen */
            <View style={styles.memberRow}>
              <View style={[styles.avatar, isMe && styles.avatarSelected]}>
                {item.avatar_url ? (
                  <AvatarImage
                    reference={item.avatar_url}
                    accessibilityLabel={t('household.members.profileImage', { name: displayName })}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Txt variant="body" weight="700">
                    {initials}
                  </Txt>
                )}
              </View>

              <View style={styles.memberCopy}>
                <Txt variant="body" weight={isMe ? '700' : '400'}>
                  {displayName} {isMe ? `(${t('household.members.you')})` : ''}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {t('household.members.roleLabel', {
                    role:
                      item.role === 'admin'
                        ? t('household.members.admin')
                        : t('household.members.member'),
                  })}
                </Txt>
              </View>

              {isAdmin && !isMe && (
                <View style={styles.memberActions}>
                  <Press
                    onPress={() => handleToggleRole(item.user_id, item.role, displayName)}
                    accessibilityRole="button"
                    accessibilityLabel={t('household.members.roleAccessibility', {
                      role:
                        item.role === 'admin'
                          ? t('household.members.admin')
                          : t('household.members.member'),
                    })}
                    style={styles.roleTag}>
                    <Txt variant="caption" tone="primary">
                      {item.role === 'admin'
                        ? `${t('household.members.admin')} ▾`
                        : `${t('household.members.member')} ▾`}
                    </Txt>
                  </Press>
                  <Press
                    onPress={() => handleRemoveMember(item.user_id, displayName)}
                    accessibilityRole="button"
                    accessibilityLabel={t('household.members.removeAccessibility', {
                      name: displayName,
                    })}
                    style={styles.removeTag}>
                    <Txt variant="caption" tone="danger">
                      {t('household.members.remove')}
                    </Txt>
                  </Press>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          !isLoading ? (
            /* Footer-Bereich: Kinder-Profile (Nicht-Admins), Verlassen & Löschen */
            <View style={styles.footer}>
              {!isAdmin && (
                <View style={styles.footerButton}>
                  <Button
                    title={t('household.members.childrenManage')}
                    variant="secondary"
                    onPress={() => router.push('/household/children')}
                  />
                </View>
              )}

              {isAdmin ? (
                <View style={styles.destructiveActions}>
                  <Button
                    title={t('household.members.leave')}
                    variant="danger"
                    onPress={handleLeave}
                    loading={loadingAction === 'leave'}
                    disabled={
                      !canAdminLeave || (loadingAction !== null && loadingAction !== 'leave')
                    }
                  />
                  {!canAdminLeave && (
                    <Txt variant="caption" tone="secondary" center>
                      {t('household.members.anotherAdminHint')}
                    </Txt>
                  )}
                  <Button
                    title={t('household.members.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={loadingAction === 'delete'}
                    disabled={loadingAction !== null && loadingAction !== 'delete'}
                  />
                </View>
              ) : (
                <Button
                  title={t('household.members.leave')}
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
