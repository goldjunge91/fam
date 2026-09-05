import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { space } from '@/components/theme/index';

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

export function SearchIcon({ size = space.xl, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={2} />
      <Path d="m15.5 15.5 5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function HistoryIcon({ size = space.xl, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 8.5V4.5m0 0h4m-4 0 3 3a8.5 8.5 0 1 1-1.4 10.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 7.5v5l3 1.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FilterIcon({ size = space.xl, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M7 12h10M10 17h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
