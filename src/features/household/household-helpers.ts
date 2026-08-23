import type { Database } from '@/lib/database.types';

export type HouseholdMember = Database['public']['Tables']['household_members']['Row'];

export function formatInviteUrl(token: string): string {
  return `fam://join?token=${token}`;
}

export function isHouseholdAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiryTime =
    typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return expiryTime <= now.getTime();
}

export function canAdminLeaveHousehold(members: Array<{ role: string }>): boolean {
  const adminCount = members.filter((m) => m.role === 'admin').length;
  return adminCount > 1;
}

export function canDeleteHousehold(role: string | null | undefined): boolean {
  return isHouseholdAdmin(role);
}

export function parseChildHeight(rawHeight: string | null | undefined): number | null {
  if (!rawHeight?.trim()) return null;
  const val = Number.parseFloat(rawHeight);
  return Number.isNaN(val) ? null : val;
}
