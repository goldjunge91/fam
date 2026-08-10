import {
  clearPendingInviteToken,
  consumePendingInviteToken,
  peekPendingInviteToken,
  savePendingInviteToken,
} from '@/lib/pending-invite';
import {
  canAdminLeaveHousehold,
  canDeleteHousehold,
  formatInviteUrl,
  isHouseholdAdmin,
  isInviteExpired,
  parseChildHeight,
} from './household-helpers';

describe('Household & Invites Domain Logic', () => {
  it('sollte Einladungs-URLs korrekt formatieren', () => {
    const token = '123e4567-e89b-12d3-a456-426614174000';
    const inviteUrl = formatInviteUrl(token);

    expect(inviteUrl).toBe('fam://join?token=123e4567-e89b-12d3-a456-426614174000');
    expect(inviteUrl.startsWith('fam://join')).toBe(true);
  });

  it('sollte Admin-Rolle für Haushaltsmitglieder korrekt auswerten', () => {
    expect(isHouseholdAdmin('admin')).toBe(true);
    expect(isHouseholdAdmin('member')).toBe(false);
    expect(isHouseholdAdmin(null)).toBe(false);
    expect(isHouseholdAdmin(undefined)).toBe(false);
  });

  it('sollte Verfall von Einladungstoken mit Referenzdatum prüfen', () => {
    const refNow = new Date('2026-08-10T12:00:00Z');
    const pastDate = '2026-08-10T11:00:00Z';
    const futureDate = '2026-08-10T13:00:00Z';

    expect(isInviteExpired(pastDate, refNow)).toBe(true);
    expect(isInviteExpired(futureDate, refNow)).toBe(false);
  });

  it('sollte prüfen, ob Admin den Haushalt verlassen darf (nur wenn >1 Admin existiert)', () => {
    const singleAdminMembers = [{ role: 'admin' }, { role: 'member' }];
    const multiAdminMembers = [{ role: 'admin' }, { role: 'admin' }];

    expect(canAdminLeaveHousehold(singleAdminMembers)).toBe(false);
    expect(canAdminLeaveHousehold(multiAdminMembers)).toBe(true);
  });

  it('sollte Löschrecht für Haushalt nur für Admins gewähren', () => {
    expect(canDeleteHousehold('admin')).toBe(true);
    expect(canDeleteHousehold('member')).toBe(false);
    expect(canDeleteHousehold(null)).toBe(false);
  });

  it('sollte Deep-Link Einladungstoken im Speicher ablegen und atomar konsumieren', async () => {
    const testToken = 'token-secret-123';

    await savePendingInviteToken(testToken);
    const consumedToken = await consumePendingInviteToken();
    const secondConsume = await consumePendingInviteToken();

    expect(consumedToken).toBe(testToken);
    expect(secondConsume).toBeNull();
  });

  it('sollte den Einladungs-Token per peek wiederholt lesbar halten, bis er explizit gelöscht wird (#128)', async () => {
    const testToken = 'token-secret-456';

    await savePendingInviteToken(testToken);

    const firstPeek = await peekPendingInviteToken();
    const secondPeek = await peekPendingInviteToken();
    expect(firstPeek).toBe(testToken);
    expect(secondPeek).toBe(testToken);

    await clearPendingInviteToken();
    expect(await peekPendingInviteToken()).toBeNull();
  });

  it('sollte Kinder-Profil Zusatzdaten (Height) korrekt parsen', () => {
    expect(parseChildHeight('104.5')).toBe(104.5);
    expect(parseChildHeight('  92 ')).toBe(92);
    expect(parseChildHeight('')).toBeNull();
    expect(parseChildHeight(null)).toBeNull();
    expect(parseChildHeight('invalid')).toBeNull();
  });
});
