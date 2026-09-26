import { Text, type TextProps, type TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { font, type Palette } from '@/components/theme/index';

const textToneStyles = StyleSheet.create((theme) => ({
  text: { color: theme.text },
  textSecondary: { color: theme.textSecondary },
  accent: { color: theme.accent },
  onAccent: { color: theme.onAccent },
  onSuccess: { color: theme.onSuccess },
  onWarning: { color: theme.onWarning },
  onDanger: { color: theme.onDanger },
  successText: { color: theme.successText },
  warningText: { color: theme.warningText },
  dangerText: { color: theme.dangerText },
}));

export type TxtVariant =
  | 'display'
  | 'title'
  | 'brand'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'navigation'
  | 'label'
  | 'caption'
  | 'eyebrow'
  | 'micro'
  | 'glyphCompact'
  | 'glyphSmall'
  | 'glyph'
  | 'glyphLarge';

export type TxtTone =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'onAccent'
  | 'onSuccess'
  | 'onWarning'
  | 'onDanger'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse';

type TxtDefinition = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  tone: 'text' | 'textSecondary' | 'accent';
  letterSpacing?: number;
  fontFamily?: TextStyle['fontFamily'];
};

const TXT: Record<TxtVariant, TxtDefinition> = {
  display: {
    fontSize: font.sizes.xxxl,
    lineHeight: font.lineHeights.display,
    fontWeight: font.weight.heavy,
    tone: 'text',
  },
  title: {
    fontSize: font.sizes.xxl,
    lineHeight: font.lineHeights.title,
    fontWeight: font.weight.heavy,
    tone: 'text',
  },
  brand: {
    fontSize: font.sizes.brand,
    lineHeight: font.lineHeights.brand,
    fontWeight: font.weight.semibold,
    tone: 'text',
  },
  heading: {
    fontSize: font.sizes.lg,
    lineHeight: font.lineHeights.heading,
    fontWeight: font.weight.bold,
    tone: 'text',
  },
  subheading: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
    fontWeight: font.weight.bold,
    tone: 'text',
  },
  body: {
    fontSize: font.sizes.base,
    lineHeight: font.lineHeights.body,
    fontWeight: font.weight.regular,
    tone: 'text',
  },
  navigation: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.navigation,
    fontWeight: font.weight.regular,
    tone: 'text',
  },
  label: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.label,
    fontWeight: font.weight.semibold,
    tone: 'text',
  },
  caption: {
    fontSize: font.sizes.xs,
    lineHeight: font.lineHeights.caption,
    fontWeight: font.weight.medium,
    tone: 'text',
  },
  eyebrow: {
    fontSize: font.sizes.xs,
    lineHeight: font.lineHeights.caption,
    fontWeight: font.weight.regular,
    tone: 'textSecondary',
    letterSpacing: font.letterSpacing.eyebrow,
  },
  micro: {
    fontSize: font.sizes.micro,
    lineHeight: font.lineHeights.micro,
    fontWeight: font.weight.regular,
    tone: 'textSecondary',
  },
  glyphCompact: {
    fontSize: font.sizes.glyph,
    lineHeight: font.lineHeights.glyphCompact,
    fontWeight: font.weight.regular,
    tone: 'textSecondary',
  },
  glyphSmall: {
    fontSize: font.sizes.base,
    lineHeight: font.lineHeights.compact,
    fontWeight: font.weight.regular,
    tone: 'textSecondary',
  },
  glyph: {
    fontSize: font.sizes.glyph,
    lineHeight: font.lineHeights.glyph,
    fontWeight: font.weight.regular,
    tone: 'textSecondary',
  },
  glyphLarge: {
    fontSize: font.sizes.xxl,
    lineHeight: font.lineHeights.glyphLarge,
    fontWeight: font.weight.light,
    tone: 'textSecondary',
  },
};

type ThemeTextColor = keyof Pick<
  Palette,
  | 'text'
  | 'textSecondary'
  | 'accent'
  | 'onAccent'
  | 'onSuccess'
  | 'onWarning'
  | 'onDanger'
  | 'successText'
  | 'warningText'
  | 'dangerText'
>;

const TEXT_TONE: Record<TxtTone, ThemeTextColor> = {
  primary: 'text',
  secondary: 'text',
  accent: 'accent',
  onAccent: 'onAccent',
  onSuccess: 'onSuccess',
  onWarning: 'onWarning',
  onDanger: 'onDanger',
  success: 'successText',
  warning: 'warningText',
  danger: 'dangerText',
  inverse: 'onAccent',
};

export type TxtProps = TextProps & {
  variant?: TxtVariant;
  tone?: TxtTone;
  color?: string;
  weight?: TextStyle['fontWeight'];
  tracking?: keyof typeof font.letterSpacing;
  center?: boolean;
  muted?: boolean;
};

export function Txt({
  variant = 'body',
  tone,
  color,
  weight,
  tracking,
  center,
  muted,
  style,
  children,
  ...rest
}: TxtProps) {
  const base = TXT[variant];
  const textTone = tone ? TEXT_TONE[tone] : muted ? 'textSecondary' : base.tone;
  return (
    <Text
      {...rest}
      style={[
        textToneStyles[textTone],
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: base.fontWeight,
          letterSpacing: base.letterSpacing,
          fontFamily: base.fontFamily,
        },
        color && { color },
        weight && { fontWeight: weight },
        tracking && { letterSpacing: font.letterSpacing[tracking] },
        center && { textAlign: 'center' },
        style,
      ]}>
      {children}
    </Text>
  );
}

type InputTypography = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>;

type InputTextStyles = {
  inventorySearch: InputTypography;
  recipeSearch: InputTypography;
  verificationCode: InputTypography;
  quantity: {
    standard: InputTypography;
    large: InputTypography;
  };
  grams: InputTypography;
  recipeStep: InputTypography;
};

export const inputTextStyles = {
  inventorySearch: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.label,
  },
  recipeSearch: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.search,
    fontWeight: font.weight.medium,
  },
  verificationCode: {
    fontSize: font.sizes.xl,
    letterSpacing: font.letterSpacing.verificationCode,
  },
  quantity: {
    standard: {
      fontSize: font.sizes.base,
      lineHeight: font.lineHeights.body,
      fontWeight: font.weight.semibold,
    },
    large: {
      fontSize: font.sizes.md,
      lineHeight: font.lineHeights.subheading,
      fontWeight: font.weight.semibold,
    },
  },
  grams: {
    fontSize: font.sizes.xs,
    lineHeight: font.lineHeights.caption,
    fontWeight: font.weight.medium,
  },
  recipeStep: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.navigation,
  },
} satisfies InputTextStyles;
