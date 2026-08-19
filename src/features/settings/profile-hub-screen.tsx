import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import {
  type TrackingMethod,
  useCurrentGoal,
  useLatestWeightEntry,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
} from '@/features/calorie-tracking/api';
import { calculateBmr } from '@/features/calorie-tracking/bmr';
import { type ActivityLevel, calculateTdee } from '@/features/calorie-tracking/tdee';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/lib/initials';

function formatHourString(hour: number): string {
  const clamped = Math.max(0, Math.min(23, Math.round(hour)));
  return `${String(clamped).padStart(2, '0')}:00`;
}

function TimeSlider({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const currentHour = useMemo(() => {
    const parts = value.split(':');
    const h = Number.parseInt(parts[0] || '0', 10);
    return Number.isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
  }, [value]);

  const trackWidthRef = useRef(300);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (disabled) return;
        const x = evt.nativeEvent.locationX;
        const width = trackWidthRef.current || 300;
        const hour = Math.round((x / width) * 23);
        onChange(formatHourString(hour));
      },
      onPanResponderMove: (evt) => {
        if (disabled) return;
        const x = evt.nativeEvent.locationX;
        const width = trackWidthRef.current || 300;
        const hour = Math.round((x / width) * 23);
        onChange(formatHourString(hour));
      },
    }),
  ).current;

  function step(delta: number) {
    if (disabled) return;
    const next = (currentHour + delta + 24) % 24;
    onChange(formatHourString(next));
  }

  const progressRatio = currentHour / 23;

  return (
    <View className="gap-three">
      {/* Grossanzeige der gewaehlten Zeit */}
      <View className="flex-row items-center justify-between bg-card p-three rounded-xl border border-border">
        <View>
          <ThemedText type="caption" themeColor="textSecondary">
            Tagesbeginn:
          </ThemedText>
          <ThemedText type="title" className="text-2xl font-bold">
            {formatHourString(currentHour)} Uhr
          </ThemedText>
        </View>

        {/* Stepper Buttons (-1h / +1h) */}
        <View className="flex-row gap-two">
          <Pressable
            onPress={() => step(-1)}
            disabled={disabled}
            accessibilityLabel="Eine Stunde früher"
            className="w-10 h-10 rounded-xl bg-surface border border-border items-center justify-center">
            <ThemedText type="labelBold">-1h</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            disabled={disabled}
            accessibilityLabel="Eine Stunde später"
            className="w-10 h-10 rounded-xl bg-surface border border-border items-center justify-center">
            <ThemedText type="labelBold">+1h</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Interaktiver Slider-Track */}
      <View
        className="py-two"
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}>
        <View
          className="h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: theme.backgroundElement }}>
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.max(4, progressRatio * 100)}%`,
              backgroundColor: theme.accent,
            }}
          />
        </View>

        {/* Skala Marker */}
        <View className="flex-row justify-between pt-two">
          <ThemedText type="caption" themeColor="textSecondary">
            00:00
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            06:00
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            12:00
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            18:00
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            23:00
          </ThemedText>
        </View>
      </View>

      {/* Erklaerung */}
      <ThemedText type="caption" themeColor="textSecondary">
        {currentHour === 0
          ? 'Standard: Dein Tracking-Tag beginnt und endet um Mitternacht (00:00 Uhr).'
          : `Individuell: Mahlzeiten zwischen 00:00 Uhr und ${formatHourString(currentHour)} Uhr zählen noch zum Vortag.`}
      </ThemedText>
    </View>
  );
}

const TRACKING_METHODS: { id: TrackingMethod; label: string; icon: string; desc: string }[] = [
  {
    id: 'standard',
    label: 'Klassisch (CICO)',
    icon: '🎯',
    desc: 'Kalorien & Makronährstoffe wie gewohnt tracken',
  },
  {
    id: 'glp1',
    label: 'GLP-1 & Medikation',
    icon: '💉',
    desc: 'Injektionsintervalle, Dosierungen & Symptome erfassen',
  },
  {
    id: 'fasting',
    label: 'Intervallfasten',
    icon: '⏱️',
    desc: 'Fastenphasen-Timer & individuelle Essensfenster',
  },
  {
    id: 'keto',
    label: 'Low-Carb & Keto',
    icon: '🥑',
    desc: 'Netto-Kohlenhydrate & Ketonwerte protokollieren',
  },
  {
    id: 'workouts',
    label: 'Kraftsport',
    icon: '🏋️',
    desc: 'Übungen, Sätze, Wiederholungen & Gewichte dokumentieren',
  },
  {
    id: 'cgm',
    label: 'Blutzucker & CGM',
    icon: '🩸',
    desc: 'Glukosemessungen vor & nach den Mahlzeiten loggen',
  },
  {
    id: 'volumetrics',
    label: 'Volumetrics',
    icon: '🥗',
    desc: 'Energiedichte-Ampel & Sättigungs-Scoring nutzen',
  },
];

export function ProfileHubScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: currentGoal } = useCurrentGoal(userId);
  const { data: latestWeight } = useLatestWeightEntry(userId);

  const displayName = profile?.display_name || 'Ohne Namen';
  const email = session?.user.email ?? '—';
  const initials = getInitials(displayName);

  // BMR / TDEE Berechnung
  const bmrResult = useMemo(() => {
    if (!profile) return null;
    return calculateBmr(
      {
        sex: (profile.sex as 'male' | 'female') ?? null,
        birthDate: profile.birth_date ?? null,
        heightCm: profile.height_cm ?? null,
        weightKg: latestWeight?.weight_kg ?? null,
      },
      new Date(),
    );
  }, [profile, latestWeight]);

  const bmrKcal = bmrResult?.ok ? Math.round(bmrResult.bmrKcal) : null;
  const tdeeKcal =
    bmrResult?.ok && profile?.activity_level
      ? Math.round(calculateTdee(bmrResult.bmrKcal, profile.activity_level as ActivityLevel))
      : null;

  const currentStartTime = profile?.tracking_day_start_time || '00:00';
  const updateStartTimeMutation = useUpdateTrackingDayStartTimeMutation();

  function handleSelectStartTime(time: string) {
    if (!userId || updateStartTimeMutation.isPending || time === currentStartTime) return;
    updateStartTimeMutation.mutate({ userId, time });
  }

  const currentMethod: TrackingMethod = (profile?.tracking_method as TrackingMethod) || 'standard';
  const updateMethodMutation = useUpdateTrackingMethodMutation();

  function handleSelectMethod(method: TrackingMethod) {
    if (!userId || updateMethodMutation.isPending || method === currentMethod) return;
    updateMethodMutation.mutate({ userId, method });
  }

  return (
    <Screen title="Mein Profil & Tracking">
      <ScrollView contentContainerClassName="screen-scroll" showsVerticalScrollIndicator={false}>
        {/* Kopfkarte mit Avatar */}
        <View className="profile-sheet-card p-four rounded-2xl bg-surface border border-border gap-three">
          <View className="flex-row items-center gap-three">
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.accent }}>
              <ThemedText type="title" themeColor="onAccent" className="text-xl font-bold">
                {initials}
              </ThemedText>
            </View>
            <View className="flex-1">
              <ThemedText type="smallBold" className="text-lg">
                {displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {email}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/settings/edit-profile')}
            className="pt-two border-t border-border flex-row justify-between items-center">
            <ThemedText type="smallBold" themeColor="accent">
              Stammdaten bearbeiten ›
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Geburtstag, Geschlecht, Größe
            </ThemedText>
          </Pressable>
        </View>

        {/* Vitalwerte & Energiebedarf */}
        <SettingsGroup title="Vitalwerte & Energiebedarf">
          <View className="p-three gap-three">
            {/* BMR & TDEE Kacheln */}
            <View className="flex-row gap-two">
              <View className="flex-1 p-three bg-card rounded-xl border border-border items-center justify-center">
                <ThemedText type="caption" themeColor="textSecondary">
                  Grundumsatz (BMR)
                </ThemedText>
                <ThemedText type="smallBold" className="text-base mt-one">
                  {bmrKcal ? `${bmrKcal} kcal` : 'Unvollständig'}
                </ThemedText>
              </View>
              <View className="flex-1 p-three bg-card rounded-xl border border-border items-center justify-center">
                <ThemedText type="caption" themeColor="textSecondary">
                  Gesamtbedarf (TDEE)
                </ThemedText>
                <ThemedText type="smallBold" className="text-base mt-one">
                  {tdeeKcal ? `${tdeeKcal} kcal` : 'Unvollständig'}
                </ThemedText>
              </View>
            </View>

            <View className="flex-row justify-between pt-one border-t border-border">
              <ThemedText type="small" themeColor="textSecondary">
                Größe: {profile?.height_cm ? `${profile.height_cm} cm` : '–'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Gewicht: {latestWeight?.weight_kg ? `${latestWeight.weight_kg} kg` : '–'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Geschlecht:{' '}
                {profile?.sex === 'male'
                  ? 'Männlich'
                  : profile?.sex === 'female'
                    ? 'Weiblich'
                    : '–'}
              </ThemedText>
            </View>
          </View>
        </SettingsGroup>

        {/* Ernährung & Tagesziele */}
        <SettingsGroup title="Ernährung & Tagesziele">
          <SettingsRow
            icon="🎯"
            label="Kalorien-Tagesziel"
            value={currentGoal?.daily_kcal ? `${currentGoal.daily_kcal} kcal` : 'Nicht gesetzt'}
            hint="Protein, Kohlenhydrate & Fett anpassen"
            onPress={() => router.push('/settings/goals')}
          />
          <SettingsRow
            icon="🥗"
            label="Makro-Verteilung"
            value={
              currentGoal
                ? `P: ${currentGoal.protein_g}g · C: ${currentGoal.carbs_g}g · F: ${currentGoal.fat_g}g`
                : '–'
            }
            last
            onPress={() => router.push('/settings/goals')}
          />
        </SettingsGroup>

        {/* Tracking-Rhythmus & Zeitfenster */}
        <SettingsGroup title="Tracking-Rhythmus & Zeitfenster">
          <View className="p-three">
            <TimeSlider
              value={currentStartTime}
              onChange={handleSelectStartTime}
              disabled={updateStartTimeMutation.isPending}
            />
          </View>
        </SettingsGroup>

        {/* Tracking-Methode */}
        <SettingsGroup title="Deine Tracking-Methode">
          <View className="p-three gap-two">
            <ThemedText type="small" themeColor="textSecondary" className="mb-one">
              Wähle deine aktive Methode für das Ernährungstagebuch:
            </ThemedText>
            <View className="gap-two">
              {TRACKING_METHODS.map((m) => {
                const isSelected = currentMethod === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => handleSelectMethod(m.id)}
                    disabled={updateMethodMutation.isPending}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.border,
                    }}
                    className="p-three rounded-xl border flex-row items-center justify-between">
                    <View className="flex-row items-center gap-three flex-1 mr-two">
                      <ThemedText type="subtitle">{m.icon}</ThemedText>
                      <View className="flex-1">
                        <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                          {m.label}
                        </ThemedText>
                        <ThemedText
                          type="captionCompact"
                          themeColor={isSelected ? 'onAccent' : 'textSecondary'}>
                          {m.desc}
                        </ThemedText>
                      </View>
                    </View>
                    {isSelected ? (
                      <ThemedText type="smallBold" themeColor="onAccent">
                        Aktiv ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
