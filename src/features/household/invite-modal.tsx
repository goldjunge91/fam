import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import {
  useCreateInviteMutation,
  useHouseholdInvites,
  useRevokeInviteMutation,
} from '@/features/household/api';
import { formatInviteUrl } from '@/features/household/household-helpers';

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
      <View className="modal-backdrop-bottom">
        <View className="invite-modal-box">
          <ScrollView contentContainerClassName="invite-modal-content">
            <View className="modal-header-row">
              <ThemedText type="subtitle">Mitglied einladen</ThemedText>
              <Pressable onPress={onClose} hitSlop={10}>
                <ThemedText themeColor="textSecondary" className="text-[18px]">
                  ✕
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Erstelle einen Einladungs-Link oder Code, um Familienmitglieder oder Mitbewohner zu
              &quot;{householdName}&quot; einzuladen.
            </ThemedText>

            {selectedToken ? (
              <Card title="Einladungs-Code & QR-Code">
                <View className="gap-two">
                  <ThemedText className="invite-token-text">{selectedToken}</ThemedText>

                  {showQrCode && (
                    <View className="invite-qr-container">
                      <QRCode value={formatInviteUrl(selectedToken)} size={180} />
                    </View>
                  )}

                  <View className="flex-row gap-two">
                    <View className="flex-1">
                      <Button
                        label={copyFeedback === 'code' ? '✓ Code kopiert!' : 'Code kopieren'}
                        onPress={() => handleCopyCode(selectedToken)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label={copyFeedback === 'link' ? '✓ Link kopiert!' : 'Link kopieren'}
                        onPress={() => handleCopyLink(selectedToken)}
                      />
                    </View>
                  </View>

                  <Button
                    label={showQrCode ? 'QR-Code ausblenden' : 'QR-Code anzeigen'}
                    variant="secondary"
                    onPress={() => setShowQrCode(!showQrCode)}
                  />
                  <Button
                    label="Code / Link teilen"
                    variant="secondary"
                    onPress={() => handleShare(selectedToken)}
                  />
                  <Button
                    label="+ Neuer Einladungs-Code"
                    variant="secondary"
                    onPress={handleCreate}
                    loading={createMutation.isPending}
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

            <ThemedText className="font-bold mt-two">Aktive Einladungen</ThemedText>
            {invites.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Keine aktiven Einladungen vorhanden.
              </ThemedText>
            ) : (
              invites.map((inv) => {
                const isSelected = inv.token === selectedToken;
                return (
                  <View
                    key={inv.id}
                    className={`invite-row ${isSelected ? 'invite-row-selected' : ''}`}>
                    <Pressable
                      className="flex-1"
                      onPress={() => {
                        setSelectedToken(inv.token);
                        setShowQrCode(true);
                      }}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {inv.token}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Gültig bis {new Date(inv.expires_at).toLocaleDateString('de-DE')} ·{' '}
                        {inv.uses}/{inv.max_uses} genutzt
                      </ThemedText>
                    </Pressable>
                    <View className="invite-row-buttons">
                      <Pressable
                        onPress={() => {
                          setSelectedToken(inv.token);
                          setShowQrCode(true);
                        }}
                        accessibilityLabel="QR-Code anzeigen"
                        className="invite-action-icon-button">
                        <ThemedText className="invite-action-icon-text">📱</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => handleShare(inv.token)}
                        accessibilityLabel="Teilen"
                        className="invite-action-icon-button">
                        <ThemedText className="invite-action-icon-text">📤</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRevoke(inv.id)}
                        accessibilityLabel="Zurückziehen"
                        className="invite-action-icon-button">
                        <ThemedText className="invite-action-icon-text">🗑</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
