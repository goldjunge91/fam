import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const ICONS = {
  overview: require('@/assets/images/figma/nav-overview.svg'),
  fridge: require('@/assets/images/figma/nav-fridge.svg'),
  shopping: require('@/assets/images/figma/nav-shopping.svg'),
  recipes: require('@/assets/images/figma/nav-recipes.svg'),
  mealPlan: require('@/assets/images/figma/nav-meal-plan.svg'),
  diary: require('@/assets/images/figma/nav-diary.svg'),
  goals: require('@/assets/images/figma/nav-goals.svg'),
  settings: require('@/assets/images/figma/nav-settings.svg'),
  profile: require('@/assets/images/figma/profile-person.svg'),
  household: require('@/assets/images/figma/profile-house.svg'),
  members: require('@/assets/images/figma/profile-members.svg'),
  premium: require('@/assets/images/figma/profile-premium.svg'),
  chevron: require('@/assets/images/figma/chevron.svg'),
  mealArtwork: require('@/assets/images/figma/meal-artwork.svg'),
  camera: require('@/assets/images/figma/camera-1.svg'),
} as const;

export type FamIconName = keyof typeof ICONS;

export function FamIcon({
  name,
  size,
  color,
}: {
  name: FamIconName;
  size: number;
  color?: string;
}) {
  return (
    <Image
      source={ICONS[name]}
      contentFit="contain"
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

export function MenuIcon({ size = 26 }: { size?: number }) {
  const lineWidth = size * (2 / 3);

  return (
    <View style={{ width: size, height: size }}>
      {[0.25, 0.5, 0.75].map((position) => (
        <Image
          key={position}
          source={require('@/assets/images/figma/menu-line.svg')}
          contentFit="fill"
          style={[
            styles.iconPart,
            {
              left: (size - lineWidth) / 2,
              top: size * position - 1,
              width: lineWidth,
              height: 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function PlusIcon({ size = 28 }: { size?: number }) {
  const strokeLength = size * (7 / 12);
  const offset = (size - strokeLength) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('@/assets/images/figma/plus-horizontal.svg')}
        contentFit="fill"
        style={[
          styles.iconPart,
          { left: offset, top: size / 2 - 1, width: strokeLength, height: 2 },
        ]}
      />
      <Image
        source={require('@/assets/images/figma/plus-vertical.svg')}
        contentFit="fill"
        style={[
          styles.iconPart,
          { left: size / 2 - 1, top: offset, width: 2, height: strokeLength },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconPart: {
    position: 'absolute',
  },
});
