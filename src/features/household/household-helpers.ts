import type { Database } from '@/lib/database.types';

export type HouseholdMember = Database['public']['Tables']['household_members']['Row'];

/**
 * Formatiert den Einladungs-Link für einen Haushalts-Token.
 */
export function formatInviteUrl(token: string): string {
  return `fam://join?token=${token}`;
}

/**
 * Prüft, ob ein Mitglied die Admin-Rolle besitzt.
 */
export function isHouseholdAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Prüft, ob ein Einladungstoken abgelaufen ist.
 */
export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiryTime =
    typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return expiryTime <= now.getTime();
}

/**
 * Prüft, ob ein Admin den Haushalt verlassen kann (nur gestattet, wenn mindestens 1 weiterer Admin existiert).
 */
export function canAdminLeaveHousehold(members: Array<{ role: string }>): boolean {
  const adminCount = members.filter((m) => m.role === 'admin').length;
  return adminCount > 1;
}

/**
 * Prüft, ob ein Mitglied das Recht hat, den Haushalt zu löschen (nur Admins).
 */
export function canDeleteHousehold(role: string | null | undefined): boolean {
  return isHouseholdAdmin(role);
}

/**
 * Formatiert Kind-Profil-Zusatzdaten (Größe).
 */
export function parseChildHeight(rawHeight: string | null | undefined): number | null {
  if (!rawHeight?.trim()) return null;
  const val = Number.parseFloat(rawHeight);
  return Number.isNaN(val) ? null : val;
}
