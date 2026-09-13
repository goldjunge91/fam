import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  useCreateInviteMutation,
  useHouseholdInvites,
  useRevokeInviteMutation,
} from '@/features/household/api';
import { formatInviteUrl } from '@/features/household/household-helpers';

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  modalBox: {
    maxHeight: '85%',
    padding: theme.space.xl + theme.space.xs,
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    backgroundColor: theme.background,
  },
  content: {
    gap: theme.space.lg,
    paddingBottom: theme.space.xl + theme.space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteToken: {
    paddingVertical: theme.space.sm,
  },
  tokenContent: {
    gap: theme.space.sm,
  },
  qrContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.space.sm,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    // Eine helle Quiet-Zone ist für zuverlässiges QR-Scannen erforderlich.
    backgroundColor: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  flex: {
    flex: 1,
  },
  activeHeading: {
    marginTop: theme.space.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  inviteRowSelected: {
    backgroundColor: withAlpha(theme.accent, 0.08),
    borderRadius: theme.radius.sm,
  },
  inviteRowButtons: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  inviteActionIconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.xs,
  },
}));

interface InviteModalProps {
  visible: boolean;
  householdId: string;
  householdName: string;
  onClose: () => void;
}

export function InviteModal({ visible, householdId, householdName, onClose }: InviteModalProps) {
  const { session } = useSession();
  const userId = session?.user.id ?? '';

  const { data: invites = [] } = useHouseholdInvites(householdId);
  const createMutation = useCreateInviteMutation();
  const revokeMutation = useRevokeInviteMutation();

  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<'code' | 'link' | null>(null);

  async function handleCreate() {
    if (!userId || !householdId) return;
    try {
      const invite = await createMutation.mutateAsync({
        householdId,
        createdBy: userId,
        expiresDays: 7,
        maxUses: 5,
      });
      setSelectedToken(invite.token);
      setShowQrCode(true);
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden.',
      );
    }
  }

  async function handleCopyCode(token: string) {
    try {
      await Clipboard.setStringAsync(token);
      setCopyFeedback('code');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Fehler beim Kopieren des Codes:', err);
    }
  }

  async function handleCopyLink(token: string) {
    const inviteUrl = formatInviteUrl(token);
    try {
      await Clipboard.setStringAsync(inviteUrl);
      setCopyFeedback('link');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Fehler beim Kopieren des Links:', err);
    }
  }

  async function handleShare(token: string) {
    const inviteUrl = formatInviteUrl(token);
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
            if (selectedToken && invites.find((i) => i.id === inviteId)?.token === selectedToken) {
              setSelectedToken(null);
            }
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
        <View style={styles.modalBox}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Txt variant="title" weight="600">
                Mitglied einladen
              </Txt>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Mitglied einladen schließen"
                style={styles.closeButton}>
                <Txt variant="subheading" tone="secondary" weight="500">
                  ✕
                </Txt>
              </Pressable>
            </View>

            <Txt variant="body" tone="secondary" weight="500">
              Erstelle einen Einladungs-Link oder Code, um Familienmitglieder oder Mitbewohner zu
              &quot;{householdName}&quot; einzuladen.
            </Txt>

            {selectedToken ? (
              <Card title="Einladungs-Code & QR-Code">
                <View style={styles.tokenContent}>
                  <Txt variant="body" tone="accent" center style={styles.inviteToken}>
                    {selectedToken}
                  </Txt>

                  {showQrCode && (
                    <View style={styles.qrContainer}>
                      <QRCode value={formatInviteUrl(selectedToken)} size={180} />
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <View style={styles.flex}>
                      <Button
                        title={copyFeedback === 'code' ? '✓ Code kopiert!' : 'Code kopieren'}
                        onPress={() => handleCopyCode(selectedToken)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={copyFeedback === 'link' ? '✓ Link kopiert!' : 'Link kopieren'}
                        onPress={() => handleCopyLink(selectedToken)}
                      />
                    </View>
                  </View>

                  <Button
                    title={showQrCode ? 'QR-Code ausblenden' : 'QR-Code anzeigen'}
                    variant="secondary"
                    onPress={() => setShowQrCode(!showQrCode)}
                  />
                  <Button
                    title="Code / Link teilen"
                    variant="secondary"
                    onPress={() => handleShare(selectedToken)}
                  />
                  <Button
                    title="+ Neuer Einladungs-Code"
                    variant="secondary"
                    onPress={handleCreate}
                    loading={createMutation.isPending}
                  />
                </View>
              </Card>
            ) : (
              <Button
                title="+ Einladungs-Link erstellen"
                onPress={handleCreate}
                loading={createMutation.isPending}
              />
            )}

            <Txt variant="body" weight="700" style={styles.activeHeading}>
              Aktive Einladungen
            </Txt>
            {invites.length === 0 ? (
              <Txt variant="body" tone="secondary" weight="500">
                Keine aktiven Einladungen vorhanden.
              </Txt>
            ) : (
              invites.map((inv) => {
                const isSelected = inv.token === selectedToken;
                return (
                  <View
                    key={inv.id}
                    style={[styles.inviteRow, isSelected && styles.inviteRowSelected]}>
                    <Pressable
                      style={styles.flex}
                      onPress={() => {
                        setSelectedToken(inv.token);
                        setShowQrCode(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Einladung ${inv.token} auswählen`}
                      accessibilityState={{ selected: isSelected }}>
                      <Txt variant="body" weight="700" numberOfLines={1}>
                        {inv.token}
                      </Txt>
                      <Txt variant="body" tone="secondary" weight="500">
                        Gültig bis {new Date(inv.expires_at).toLocaleDateString('de-DE')} ·{' '}
                        {inv.uses}/{inv.max_uses} genutzt
                      </Txt>
                    </Pressable>
                    <View style={styles.inviteRowButtons}>
                      <Pressable
                        onPress={() => {
                          setSelectedToken(inv.token);
                          setShowQrCode(true);
                        }}
                        accessibilityLabel="QR-Code anzeigen"
                        accessibilityRole="button"
                        style={styles.inviteActionIconButton}>
                        <Txt variant="body">📱</Txt>
                      </Pressable>
                      <Pressable
                        onPress={() => handleShare(inv.token)}
                        accessibilityLabel="Teilen"
                        accessibilityRole="button"
                        style={styles.inviteActionIconButton}>
                        <Txt variant="body">📤</Txt>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRevoke(inv.id)}
                        accessibilityLabel="Zurückziehen"
                        accessibilityRole="button"
                        style={styles.inviteActionIconButton}>
                        <Txt variant="body">🗑</Txt>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <Button title="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
