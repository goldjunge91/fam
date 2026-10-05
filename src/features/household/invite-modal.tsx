import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { ContentCard } from '@/components/ui/content-card';
import { Button, CloseButton, IconButton, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  useCreateInviteMutation,
  useHouseholdInvites,
  useRevokeInviteMutation,
} from '@/features/household/api';
import { formatInviteUrl } from '@/features/household/household-helpers';
import { debugError } from '@/lib/observability/debug-log';

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  modalBox: {
    maxHeight: '85%',
    padding: theme.space.xxl,
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    backgroundColor: theme.background,
  },
  content: {
    gap: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: theme.qrBackground,
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
  inviteRowSelection: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
  },
  inviteRowButtons: {
    flexDirection: 'row',
    gap: theme.space.sm,
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

  const [selectedInvite, setSelectedInvite] = useState<{ token: string; code: string } | null>(
    null,
  );
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
      setSelectedInvite({ token: invite.token, code: invite.code });
      setShowQrCode(true);
    } catch (err) {
      Alert.alert(
        'Fehler',
        err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden.',
      );
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await Clipboard.setStringAsync(code);
      setCopyFeedback('code');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      debugError('Fehler beim Kopieren des Codes:', err);
    }
  }

  async function handleCopyLink(token: string) {
    const inviteUrl = formatInviteUrl(token);
    try {
      await Clipboard.setStringAsync(inviteUrl);
      setCopyFeedback('link');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      debugError('Fehler beim Kopieren des Links:', err);
    }
  }

  async function handleShare(code: string, token: string) {
    const inviteUrl = formatInviteUrl(token);
    try {
      await Share.share({
        message: `Tritt unserem Haushalt "${householdName}" in Fam bei!\n\nEinladungs-Code: ${code}\nLink: ${inviteUrl}`,
      });
    } catch (err) {
      debugError(err);
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
            if (
              selectedInvite &&
              invites.find((i) => i.id === inviteId)?.token === selectedInvite.token
            ) {
              setSelectedInvite(null);
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
              <CloseButton
                onPress={onClose}
                hitSlop={10}
                accessibilityLabel="Mitglied einladen schließen"
              />
            </View>

            <Txt variant="body" tone="secondary" weight="500">
              Erstelle einen Einladungs-Link oder Code, um Familienmitglieder oder Mitbewohner zu
              &quot;{householdName}&quot; einzuladen.
            </Txt>

            {selectedInvite ? (
              <ContentCard title="Einladungs-Code & QR-Code">
                <View style={styles.tokenContent}>
                  <Txt variant="body" tone="accent" center style={styles.inviteToken}>
                    {selectedInvite.code}
                  </Txt>

                  {showQrCode && (
                    <View style={styles.qrContainer}>
                      <QRCode value={formatInviteUrl(selectedInvite.token)} size={180} />
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <View style={styles.flex}>
                      <Button
                        title={copyFeedback === 'code' ? '✓ Code kopiert!' : 'Code kopieren'}
                        onPress={() => handleCopyCode(selectedInvite.code)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={copyFeedback === 'link' ? '✓ Link kopiert!' : 'Link kopieren'}
                        onPress={() => handleCopyLink(selectedInvite.token)}
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
                    onPress={() => handleShare(selectedInvite.code, selectedInvite.token)}
                  />
                  <Button
                    title="+ Neuer Einladungs-Code"
                    variant="secondary"
                    onPress={handleCreate}
                    loading={createMutation.isPending}
                  />
                </View>
              </ContentCard>
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
                const isSelected = inv.token === selectedInvite?.token;
                return (
                  <View
                    key={inv.id}
                    style={[styles.inviteRow, isSelected && styles.inviteRowSelected]}>
                    <Press
                      containerStyle={styles.flex}
                      style={styles.inviteRowSelection}
                      haptic="selection"
                      onPress={() => {
                        setSelectedInvite({ token: inv.token, code: inv.code });
                        setShowQrCode(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Einladung ${inv.code} auswählen`}
                      accessibilityState={{ selected: isSelected }}>
                      <Txt variant="body" weight="700" numberOfLines={1}>
                        {inv.code}
                      </Txt>
                      <Txt variant="body" tone="secondary" weight="500">
                        Gültig bis {new Date(inv.expires_at).toLocaleDateString('de-DE')} ·{' '}
                        {inv.uses}/{inv.max_uses} genutzt
                      </Txt>
                    </Press>
                    <View style={styles.inviteRowButtons}>
                      <IconButton
                        icon="smartphone"
                        iconSize={20}
                        size={44}
                        onPress={() => {
                          setSelectedInvite({ token: inv.token, code: inv.code });
                          setShowQrCode(true);
                        }}
                        accessibilityLabel="QR-Code anzeigen"
                      />
                      <IconButton
                        icon="share-2"
                        iconSize={20}
                        size={44}
                        onPress={() => handleShare(inv.code, inv.token)}
                        accessibilityLabel="Teilen"
                      />
                      <IconButton
                        icon="trash-2"
                        iconSize={20}
                        size={44}
                        onPress={() => handleRevoke(inv.id)}
                        accessibilityLabel="Zurückziehen"
                      />
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
