/** @type {import('tailwindcss').Config} */
// Tokens spiegeln `theme.ts`; CSS-Variablen wechseln automatisch mit dem Farbschema.
// Das RGB-Format ermoeglicht Tailwind-Opacity-Modifier.
module.exports = {
  darkMode: 'media',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        text: 'rgb(var(--color-text) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'background-element': 'rgb(var(--color-background-element) / <alpha-value>)',
        'background-selected': 'rgb(var(--color-background-selected) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
        'premium-gradient-start': 'rgb(var(--color-premium-gradient-start) / <alpha-value>)',
        'premium-gradient-mid': 'rgb(var(--color-premium-gradient-mid) / <alpha-value>)',
        'premium-gradient-end': 'rgb(var(--color-premium-gradient-end) / <alpha-value>)',
        'premium-on-surface': 'rgb(var(--color-premium-on-surface) / <alpha-value>)',
        'premium-action-background': 'rgb(var(--color-premium-action-background) / <alpha-value>)',
        'premium-action-text': 'rgb(var(--color-premium-action-text) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'shadow-card': 'rgb(var(--color-shadow-card) / <alpha-value>)',
        'shadow-sheet': 'rgb(var(--color-shadow-sheet) / <alpha-value>)',
      },
      spacing: {
        half: '2px',
        one: '4px',
        two: '8px',
        three: '16px',
        four: '24px',
        five: '32px',
        six: '64px',
      },
      borderRadius: {
        hairline: '2px',
        xs: '4px',
        sm: '8px',
        control: '12px',
        'control-lg': '14px',
        card: '16px',
        sheet: '20px',
        'fam-large': '28px',
        pill: '9999px',
      },
      // Statische Annaeherung an das laufzeitabhaengige StyleSheet.hairlineWidth.
      borderWidth: {
        hairline: '0.5px',
      },
      // Spiegelt die Typografie-Rollen aus `themed-text.tsx`.
      fontSize: {
        micro: ['9px', { lineHeight: '14px' }],
        'caption-compact': ['11px', { lineHeight: '14px' }],
        caption: ['11px', { lineHeight: '15px' }],
        detail: ['12px', { lineHeight: '16px' }],
        label: ['13px', { lineHeight: '17px' }],
        'body-small': ['14px', { lineHeight: '20px' }],
        'control-value': ['15px', { lineHeight: '20px' }],
        body: ['16px', { lineHeight: '22px' }],
        'body-relaxed': ['16px', { lineHeight: '24px' }],
        'control-value-lg': ['17px', { lineHeight: '22px' }],
        'body-lg': ['18px', { lineHeight: '24px' }],
        'control-action': ['20px', { lineHeight: '22px' }],
        'heading-sm': ['20px', { lineHeight: '26px' }],
        'control-action-lg': ['22px', { lineHeight: '24px' }],
        title: ['32px', { lineHeight: '44px' }],
        display: ['48px', { lineHeight: '52px' }],
        link: ['14px', { lineHeight: '30px' }],
        // Code uebernimmt bewusst keine lineHeight.
        code: '12px',
      },
      boxShadow: {
        card: '0 8px 20px rgba(89, 64, 89, 0.09)',
        sheet: '0 10px 22px rgba(42, 31, 44, 0.22)',
        surface: '0 3px 10px rgba(89, 64, 89, 0.09)',
      },
      maxWidth: {
        content: '800px',
      },
      height: {
        control: '34px',
        'action-area': '88px',
      },
    },
  },
  plugins: [],
};
