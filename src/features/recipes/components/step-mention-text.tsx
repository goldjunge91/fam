import { ThemedText, type ThemedTextProps } from '@/components/theme/themed-text';
import { type MentionableIngredient, splitStepMentions } from '../ingredient-mentions';

interface StepMentionTextProps extends Omit<ThemedTextProps, 'children'> {
  text: string;
  ingredients: MentionableIngredient[];
}

/**
 * Rendert Zubereitungstext mit `@`-Zutaten-Erwähnungen als Klartext
 * ("50g Wurst" statt "@Wurst50") — genutzt in der Wizard-Vorschau unter dem
 * Eingabefeld sowie in Rezept-Detail und Kochmodus. Dort ist das die einzige
 * Anzeige; rohe `@`-Syntax darf einer Person, die ein Rezept liest oder
 * nachkocht, nie begegnen. Größe/Gewicht kommen per Vererbung vom
 * `type`/`className` der äußeren `ThemedText` — nur die Zutatenfarbe wird
 * pro Abschnitt überschrieben.
 */
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
