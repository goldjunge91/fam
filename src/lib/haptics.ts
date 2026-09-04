/**
 * Haptics — thin wrapper over expo-haptics that respects the user's
 * `srf:haptics-enabled` preference (shared with the web app) and never throws
 * on devices/simulators without a Taptic Engine.
 *
 * Tuned for a Duolingo-style "rewarding" feel: every tap has a tactile
 * response, primary actions hit a little harder, and wins fire a celebratory
 * burst. Keep these mapped to intent (see the helpers at the bottom).
 */
import * as Haptics from 'expo-haptics';

import { getDeviceStorage } from './storage/device-storage';

const HAPTICS_KEY = 'srf:haptics-enabled';

export function hapticsEnabled(): boolean {
  try {
    return getDeviceStorage().getBoolean(HAPTICS_KEY) ?? true;
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    getDeviceStorage().set(HAPTICS_KEY, on);
  } catch {
    // Haptics are optional feedback and must not break a settings action.
  }
}

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (!hapticsEnabled()) return;
  Haptics.impactAsync(style).catch(() => {});
}

/** Default tap — Light by default; pass a style for stronger feedback. */
export function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  impact(style);
}

export const light = () => impact(Haptics.ImpactFeedbackStyle.Light);
export const medium = () => impact(Haptics.ImpactFeedbackStyle.Medium);
export const heavy = () => impact(Haptics.ImpactFeedbackStyle.Heavy);
export const soft = () => impact(Haptics.ImpactFeedbackStyle.Soft);
export const rigid = () => impact(Haptics.ImpactFeedbackStyle.Rigid);

export function selection(): void {
  if (!hapticsEnabled()) return;
  Haptics.selectionAsync().catch(() => {});
}

export function success(): void {
  if (!hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning(): void {
  if (!hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export function error(): void {
  if (!hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/**
 * A celebratory multi-tap burst for big wins (finishing a cook, hitting a macro
 * goal, a streak). Reads like a tiny drumroll → success, the way Duolingo
 * punches a lesson-complete.
 */
export function celebrate(): void {
  if (!hapticsEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Medium), 90);
  setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), 180);
  setTimeout(() => {
    if (hapticsEnabled())
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, 300);
}

export const haptics = {
  tap,
  light,
  medium,
  heavy,
  soft,
  rigid,
  selection,
  success,
  warning,
  error,
  celebrate,
  hapticsEnabled,
  setHapticsEnabled,
};
export default haptics;
