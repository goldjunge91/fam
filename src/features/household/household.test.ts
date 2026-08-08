import {
  clearPendingInviteToken,
  consumePendingInviteToken,
  peekPendingInviteToken,
  savePendingInviteToken,
} from '@/lib/pending-invite';

describe('Household & Invites Domain Logic', () => {
  it('sollte Einladungs-URLs korrekt formatieren', () => {
    const token = '123e4567-e89b-12d3-a456-426614174000';
    const inviteUrl = `fam://join?token=${token}`;

    expect(inviteUrl).toBe('fam://join?token=123e4567-e89b-12d3-a456-426614174000');
    expect(inviteUrl.startsWith('fam://join')).toBe(true);
  });

  it('sollte Admin-Rolle für Haushaltsmitglieder korrekt auswerten', () => {
    const members = [
      { user_id: 'usr-1', role: 'admin' },
      { user_id: 'usr-2', role: 'member' },
    ];

    const isAdmin1 = members.find((m) => m.user_id === 'usr-1')?.role === 'admin';
    const isAdmin2 = members.find((m) => m.user_id === 'usr-2')?.role === 'admin';

    expect(isAdmin1).toBe(true);
    expect(isAdmin2).toBe(false);
  });

  it('sollte Verfall von Einladungstoken prüfen', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const isExpiredPast = new Date(pastDate).getTime() <= Date.now();
    const isExpiredFuture = new Date(futureDate).getTime() <= Date.now();

    expect(isExpiredPast).toBe(true);
    expect(isExpiredFuture).toBe(false);
  });

  it('sollte prüfen, ob Admin den Haushalt verlassen darf (nur wenn >1 Admin existiert)', () => {
    const singleAdminMembers = [
      { user_id: 'usr-1', role: 'admin' },
      { user_id: 'usr-2', role: 'member' },
    ];
    const multiAdminMembers = [
      { user_id: 'usr-1', role: 'admin' },
      { user_id: 'usr-2', role: 'admin' },
    ];

    const canLeaveSingle = singleAdminMembers.filter((m) => m.role === 'admin').length > 1;
    const canLeaveMulti = multiAdminMembers.filter((m) => m.role === 'admin').length > 1;

    expect(canLeaveSingle).toBe(false);
    expect(canLeaveMulti).toBe(true);
  });

  it('sollte Löschrecht für Haushalt nur für Admins gewähren', () => {
    const adminMember = { user_id: 'usr-1', role: 'admin' };
    const normalMember = { user_id: 'usr-2', role: 'member' };

    const canDeleteAdmin = adminMember.role === 'admin';
    const canDeleteMember = normalMember.role === 'admin';

    expect(canDeleteAdmin).toBe(true);
    expect(canDeleteMember).toBe(false);
  });

  it('sollte nach Löschen eines Haushalts auf den verbleibenden Haushalt oder null zurückfallen', () => {
    const remainingHouseholds = [{ id: 'hh-2', name: 'Zweithaushalt' }];
    const _deletedHouseholdId = 'hh-1';
    const selectedId: string | null = 'hh-1';

    // Fallback-Logik des ActiveHouseholdProvider
    const activeHousehold =
      remainingHouseholds.find((h) => h.id === selectedId) ?? remainingHouseholds[0] ?? null;

    expect(activeHousehold?.id).toBe('hh-2');
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

    // Mehrere gleichzeitige Konsumenten (z. B. App-Layout und Onboarding-
    // Schritt) duerfen sich beim blossen Lesen nicht gegenseitig den Token
    // wegschnappen - anders als bei consumePendingInviteToken oben.
    const firstPeek = await peekPendingInviteToken();
    const secondPeek = await peekPendingInviteToken();
    expect(firstPeek).toBe(testToken);
    expect(secondPeek).toBe(testToken);

    // Erst nach erfolgreicher Einloesung wird er wirklich entfernt.
    await clearPendingInviteToken();
    expect(await peekPendingInviteToken()).toBeNull();
  });

  it('sollte Kinder-Profil Zusatzdaten (Sex, Height) korrekt formatieren', () => {
    const rawSex: 'male' | 'female' | null = 'female';
    const rawHeight = '104.5';

    const parsedHeight = rawHeight.trim() ? Number.parseFloat(rawHeight) : null;

    expect(rawSex).toBe('female');
    expect(parsedHeight).toBe(104.5);
  });
});
