import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Txt } from '@/constants/ui';
import { AvatarImage } from '@/features/profile/avatar-image';

type ProfileAvatarEditorProps = {
  avatarUrl: string | null;
  initials: string;
  uploading: boolean;
  onPick: () => void;
  onDelete: () => void;
};

export function ProfileAvatarEditor({
  avatarUrl,
  initials,
  uploading,
  onPick,
  onDelete,
}: ProfileAvatarEditorProps) {
  return (
    <View style={styles.row}>
      <View testID="profile-avatar" style={styles.avatar}>
        {avatarUrl ? (
          <AvatarImage
            reference={avatarUrl}
            accessibilityLabel="Profilbild bearbeiten"
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <Txt variant="subheading" tone="onAccent" weight="700">
            {initials}
          </Txt>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title={uploading ? 'Wird geladen...' : avatarUrl ? 'Bild ändern' : 'Bild auswählen'}
          variant="secondary"
          onPress={onPick}
          loading={uploading}
        />
        {avatarUrl ? (
          <Pressable
            onPress={onDelete}
            disabled={uploading}
            hitSlop={8}
            style={styles.removeButton}>
            <Txt variant="caption" tone="danger">
              Bild entfernen
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.border,
    backgroundColor: theme.accent,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flex: 1,
    gap: theme.space.xs,
  },
  removeButton: {
    minHeight: 44,
    paddingVertical: theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
