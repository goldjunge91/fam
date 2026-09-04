import type { TextProps, TextStyle } from 'react-native';
import { Txt, type TxtVariant } from '@/constants/ui';
import { type MentionableIngredient, splitStepMentions } from '../domain/ingredient-mentions';

type StepMentionVariant = TxtVariant;
type StepMentionTone =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'onAccent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse';

interface StepMentionTextProps extends TextProps {
  text: string;
  ingredients: MentionableIngredient[];
  variant?: StepMentionVariant;
  tone?: StepMentionTone;
  className?: string;
  color?: string;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
}

export function StepMentionText({
  text,
  ingredients,
  variant = 'body',
  tone,
  className,
  color,
  weight,
  center,
  style,
  ...rest
}: StepMentionTextProps) {
  const segments = splitStepMentions(text, ingredients);
  return (
    <Txt
      {...rest}
      variant={variant}
      tone={tone}
      className={className}
      color={color}
      weight={weight}
      center={center}
      style={style}>
      {segments.map((segment) => {
        if (segment.kind === 'resolved') {
          return (
            <Txt
              key={segment.key}
              variant={variant}
              tone="accent"
              weight="700"
              style={[style, { fontWeight: '700' }]}>
              {segment.text}
            </Txt>
          );
        }
        if (segment.kind === 'unresolved') {
          return (
            <Txt key={segment.key} variant={variant} tone="danger" weight={weight} style={style}>
              {segment.text}
            </Txt>
          );
        }
        return (
          <Txt key={segment.key} variant={variant} tone={tone} weight={weight} style={style}>
            {segment.text}
          </Txt>
        );
      })}
    </Txt>
  );
}
