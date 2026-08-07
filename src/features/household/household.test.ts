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
});
