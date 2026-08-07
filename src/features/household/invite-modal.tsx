import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  useCreateInviteMutation,
  useHouseholdInvites,
  useRevokeInviteMutation,
} from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';

interface InviteModalProps {
  visible: boolean;
  householdId: string;
  householdName: string;
  onClose: () => void;
}

export function InviteModal({ visible, householdId, householdName, onClose }: InviteModalProps) {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id ?? '';

  const { data: invites = [] } = useHouseholdInvites(householdId);
  const createMutation = useCreateInviteMutation();
  const revokeMutation = useRevokeInviteMutation();

  const [createdToken, setCreatedToken] = useState<string | null>(null);

  async function handleCreate() {
    if (!userId || !householdId) return;
    try {
      const invite = await createMutation.mutateAsync({
        householdId,
        createdBy: userId,
        expiresDays: 7,
        maxUses: 5,
      });
      setCreatedToken(invite.token);
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden.',
      );
    }
  }

  async function handleShare(token: string) {
    const inviteUrl = `fam://join?token=${token}`;
    try {
      await Share.share({
        message: `Tritt unserem Haushalt "${householdName}" in Fam bei!\n\nEinladungs-Code: ${token}\nLink: ${inviteUrl}`,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRevoke(inviteId: string) {
    Alert.alert('Einladung zurückziehen', 'Möchtest du dieses Einladungstoken ungültig machen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zurückziehen',
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeMutation.mutateAsync({ inviteId, householdId });
          } catch (err) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Zurückziehen');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <ThemedText type="subtitle">Mitglied einladen</ThemedText>
              <Pressable onPress={onClose} hitSlop={10}>
                <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>✕</ThemedText>
              </Pressable>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Erstelle einen Einladungs-Link oder Code, um Familienmitglieder oder Mitbewohner zu
              &quot;{householdName}&quot; einzuladen.
            </ThemedText>

            {createdToken ? (
              <Card title="Neuer Einladungs-Code">
                <View style={styles.createdBox}>
                  <ThemedText style={styles.tokenText}>{createdToken}</ThemedText>
                  <Button label="Code / Link teilen" onPress={() => handleShare(createdToken)} />
                  <Button
                    label="Weiterer Code"
                    variant="secondary"
                    onPress={() => setCreatedToken(null)}
                  />
                </View>
              </Card>
            ) : (
              <Button
                label="+ Einladungs-Link erstellen"
                onPress={handleCreate}
                loading={createMutation.isPending}
              />
            )}

            <ThemedText style={styles.sectionTitle}>Aktive Einladungen</ThemedText>
            {invites.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Keine aktiven Einladungen vorhanden.
              </ThemedText>
            ) : (
              invites.map((inv) => (
                <View key={inv.id} style={[styles.inviteRow, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {inv.token}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Gültig bis {new Date(inv.expires_at).toLocaleDateString('de-DE')} · {inv.uses}
                      /{inv.max_uses} genutzt
                    </ThemedText>
                  </View>
                  <View style={styles.inviteButtons}>
                    <Pressable
                      onPress={() => handleShare(inv.token)}
                      style={styles.actionIconButton}>
                      <ThemedText style={{ fontSize: 16 }}>📤</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => handleRevoke(inv.id)} style={styles.actionIconButton}>
                      <ThemedText style={{ fontSize: 16 }}>🗑</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    maxHeight: '85%',
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdBox: {
    gap: Spacing.two,
  },
  tokenText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#10B981',
    textAlign: 'center',
    paddingVertical: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: Spacing.two,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconButton: {
    padding: 6,
  },
});
