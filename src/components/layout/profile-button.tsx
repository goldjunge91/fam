import { useTranslation } from 'react-i18next';
import { Press, profileButtonStyles, Txt } from '@/constants/ui';
import { AvatarImage } from '@/features/profile/avatar-image';

type ProfileButtonProps = {
  initials: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header: zeigt das Profilbild, sonst die Initialen. */
export function ProfileButton({ initials, avatarUrl, onPress }: ProfileButtonProps) {
  const { t } = useTranslation();
  // Statischer Style statt Pressable-Style-Funktion: Letztere wird auf dem Gerät
  // nicht angewendet, der Button blieb dann ohne Größe und Hintergrund unsichtbar.
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.profile.open')}
      style={profileButtonStyles.button}>
      {avatarUrl ? (
        <AvatarImage
          reference={avatarUrl}
          accessibilityLabel={t('common.profile.image')}
          accessible={false}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <Txt variant="body" tone="onAccent" weight="500">
          {initials}
        </Txt>
      )}
    </Press>
  );
}
