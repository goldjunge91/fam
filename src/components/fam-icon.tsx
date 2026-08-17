import { Image } from 'expo-image';
import { View } from 'react-native';

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
  arrow: require('@/assets/images/figma/arrow.svg'),
  mealArtwork: require('@/assets/images/figma/meal-artwork.svg'),
  camera: require('@/assets/images/figma/camera-1.svg'),
} as const;

export type FamIconName = keyof typeof ICONS;

/**
 * Image (expo-image) ist bei NativeWind nicht registriert (kein
 * cssInterop) — className wird auf Image-Elementen stillschweigend
 * ignoriert statt einen Fehler zu werfen. Groesse/Position laufen hier
 * deshalb ausschliesslich ueber style.
 */
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

export function MenuIcon({ color }: { size?: number; color?: string }) {
  return (
    <View className="w-[26px] h-[26px] items-center justify-center gap-[4px]">
      <Image
        source={require('@/assets/images/figma/menu-line.svg')}
        contentFit="fill"
        tintColor={color}
        style={{ width: 17, height: 2 }}
      />
      <Image
        source={require('@/assets/images/figma/menu-line.svg')}
        contentFit="fill"
        tintColor={color}
        style={{ width: 17, height: 2 }}
      />
      <Image
        source={require('@/assets/images/figma/menu-line.svg')}
        contentFit="fill"
        tintColor={color}
        style={{ width: 17, height: 2 }}
      />
    </View>
  );
}

export function PlusIcon({ color }: { size?: number; color?: string }) {
  return (
    <View className="w-[28px] h-[28px] items-center justify-center relative">
      <Image
        source={require('@/assets/images/figma/plus-horizontal.svg')}
        contentFit="fill"
        tintColor={color}
        style={{ width: 16, height: 2, position: 'absolute' }}
      />
      <Image
        source={require('@/assets/images/figma/plus-vertical.svg')}
        contentFit="fill"
        tintColor={color}
        style={{ width: 2, height: 16, position: 'absolute' }}
      />
    </View>
  );
}
