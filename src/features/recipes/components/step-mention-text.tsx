import { ThemedText, type ThemedTextProps } from '@/components/theme/themed-text';
import { type MentionableIngredient, splitStepMentions } from '../ingredient-mentions';

interface StepMentionTextProps extends Omit<ThemedTextProps, 'children'> {
  text: string;
  ingredients: MentionableIngredient[];
}

/** Rendert `@`-Zutaten als Klartext und hebt nur deren Farbe hervor. */
export function StepMentionText({ text, ingredients, ...rest }: StepMentionTextProps) {
  const segments = splitStepMentions(text, ingredients);
  return (
    <ThemedText {...rest}>
      {segments.map((segment) => {
        if (segment.kind === 'resolved') {
          return (
            <ThemedText key={segment.key} themeColor="accent" className="font-bold">
              {segment.text}
            </ThemedText>
          );
        }
        if (segment.kind === 'unresolved') {
          return (
            <ThemedText key={segment.key} themeColor="danger">
              {segment.text}
            </ThemedText>
          );
        }
        return <ThemedText key={segment.key}>{segment.text}</ThemedText>;
      })}
    </ThemedText>
  );
}
