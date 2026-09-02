import { routeSkillIntent } from '@/features/ai-agent-skills/domain/skill-routing';

describe('routeSkillIntent', () => {
  it('routes cooking intent before ingredient words in the same sentence', () => {
    expect(routeSkillIntent('Was kann ich mit den Zutaten die ich habe kochen?')).toBe(
      'fam-cook-from-inventory',
    );
  });

  it('routes a natural-language inventory report to capture', () => {
    expect(routeSkillIntent('Ich habe noch zwei Paprika und etwas Spinat.')).toBe(
      'fam-inventory-capture',
    );
    expect(routeSkillIntent('Ich habe Äpfel.')).toBe('fam-inventory-capture');
  });

  it('does not claim product search or ambiguous text', () => {
    expect(routeSkillIntent('Finde Paprika im Katalog')).toBeNull();
    expect(routeSkillIntent('Ich habe eine Frage')).toBeNull();
    expect(routeSkillIntent('Hallo')).toBeNull();
  });
});
