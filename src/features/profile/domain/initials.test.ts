import { getInitials } from './initials';

describe('getInitials', () => {
  it.each([null, undefined, '', '   '])('returns a placeholder for an empty name (%s)', (name) => {
    expect(getInitials(name)).toBe('?');
  });

  it('uses up to two letters for a single name', () => {
    expect(getInitials('  marco  ')).toBe('MA');
    expect(getInitials('M')).toBe('M');
  });

  it('uses the first and last initials for a full name', () => {
    expect(getInitials('marco van dijk')).toBe('MD');
  });
});
