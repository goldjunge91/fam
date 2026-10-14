import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ComponentsShowcase } from './showcase-components';

jest.mock('@expo/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(View, null, children);
  const FieldGroup = Object.assign(Wrapper, { Section: Wrapper });
  const Icon = Object.assign(
    ({ name }: { name: string }) => React.createElement(Text, null, name),
    { select: jest.fn(() => 'selected-icon') },
  );
  return {
    FieldGroup,
    Host: Wrapper,
    Icon,
    ListItem: ({ children, onPress }: { children: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: children, onPress },
        React.createElement(Text, null, children),
      ),
  };
});

jest.mock('@expo/ui/community/segmented-control', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: ({
      values,
      onChange,
    }: {
      values: string[];
      onChange: (event: { nativeEvent: { selectedSegmentIndex: number } }) => void;
    }) =>
      React.createElement(
        View,
        null,
        ...values.map((value, selectedSegmentIndex) =>
          React.createElement(
            Pressable,
            {
              key: value,
              accessibilityRole: 'button',
              accessibilityLabel: `Expo ${value}`,
              onPress: () => onChange({ nativeEvent: { selectedSegmentIndex } }),
            },
            React.createElement(Text, null, value),
          ),
        ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Expo ungültige Auswahl',
            onPress: () => onChange({ nativeEvent: { selectedSegmentIndex: 10 } }),
          },
          React.createElement(Text, null, 'Ungültige Auswahl'),
        ),
      ),
  };
});

jest.mock('@expo/ui/swift-ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(View, null, children);
  const Button = ({ label, onPress }: { label: string; onPress: () => void }) =>
    React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: label, onPress },
      React.createElement(Text, null, label),
    );
  const DatePicker = ({ onDateChange }: { onDateChange: (date: Date) => void }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: 'Datum ändern',
        onPress: () => onDateChange(new Date(2026, 9, 11, 12)),
      },
      React.createElement(Text, null, 'Datum ändern'),
    );
  const ConfirmationDialog = Object.assign(Wrapper, {
    Trigger: Wrapper,
    Message: Wrapper,
    Actions: Wrapper,
  });
  return {
    ConfirmationDialog,
    RNHostView: Wrapper,
    BottomSheet: ({
      anchor,
      children,
      isPresented,
      onIsPresentedChange,
      onDismiss,
    }: {
      anchor: ReactNode;
      children: ReactNode;
      isPresented: boolean;
      onIsPresentedChange: (presented: boolean) => void;
      onDismiss: () => void;
    }) =>
      React.createElement(
        View,
        null,
        anchor,
        Button({
          label: 'Native sheet state change',
          onPress: () => onIsPresentedChange(!isPresented),
        }),
        Button({ label: 'Native sheet dismiss', onPress: onDismiss }),
        children,
      ),
    Button,
    DatePicker,
    Group: Wrapper,
    Host: Wrapper,
    Text: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
    VStack: Wrapper,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  datePickerStyle: (style: string) => style,
  presentationDetents: (detents: unknown[]) => detents,
  presentationDragIndicator: (visibility: string) => visibility,
}));

jest.mock('@/components/theme/index', () => ({
  radius: { md: 8, pill: 999, xl: 20 },
  space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 24, xxl: 32 },
  withAlpha: (color: string, alpha: number) => `${color}:${alpha}`,
}));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#76556f',
      background: '#fffaf6',
      backgroundSoft: '#f4eee8',
      border: '#ddd',
      danger: '#b33',
      success: '#287b53',
      text: '#222',
      textSecondary: '#666',
      warning: '#9a6b00',
    },
  }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const box = (children: ReactNode) => React.createElement(View, null, children);
  const button = (label: string, onPress?: () => void, disabled?: boolean) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: label,
        onPress,
        disabled,
      },
      React.createElement(Text, null, label),
    );
  const Button = ({
    title,
    onPress,
    disabled,
  }: {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => button(title, onPress, disabled);
  const Segment = ({
    options,
    onSelect,
  }: {
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) =>
    React.createElement(
      View,
      null,
      ...options.map(({ label, value }) =>
        React.createElement(
          Pressable,
          {
            key: value,
            accessibilityRole: 'button',
            accessibilityLabel: label,
            onPress: () => onSelect(value),
          },
          React.createElement(Text, null, label),
        ),
      ),
    );
  const Pill = ({
    label,
    onPress,
    selected,
  }: {
    label: string;
    onPress: () => void;
    selected: boolean;
  }) => button(`${label}${selected ? ' ausgewählt' : ''}`, onPress);
  const Press = ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel, onPress },
      children,
    );
  const SectionHeading = ({
    title,
    action,
    onAction,
  }: {
    title: string;
    action: string;
    onAction: () => void;
  }) =>
    React.createElement(
      View,
      null,
      React.createElement(Text, null, title),
      button(action, onAction),
    );
  const IconButton = ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => button(accessibilityLabel, onPress);
  const TextField = ({ label, placeholder }: { label: string; placeholder: string }) =>
    React.createElement(TextInput, { accessibilityLabel: label, placeholder });
  return {
    Badge: ({ label }: { label: string }) => React.createElement(Text, null, label),
    Button,
    Divider: () => React.createElement(View),
    SegmentedControl: Segment,
    IconButton,
    Pill,
    Press,
    PrimitiveButton: Button,
    Card: ({ children }: { children: ReactNode }) => box(children),
    Row: ({ children }: { children: ReactNode }) => box(children),
    SectionHeading,
    Spacer: () => React.createElement(View),
    Surface: ({ children }: { children: ReactNode }) => box(children),
    TextField,
    Txt: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/components/ui/compact-action-button', () => ({
  CompactActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: label, onPress },
      React.createElement(Text, null, label),
    );
  },
}));

jest.mock('@/components/ui/content-card', () => ({
  ContentCard: ({ title, children }: { title: string; children: ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(View, null, React.createElement(Text, null, title), children);
  },
}));

jest.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title, hint, action }: { title: string; hint: string; action: ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      View,
      null,
      React.createElement(Text, null, title),
      React.createElement(Text, null, hint),
      action,
    );
  },
}));

jest.mock('@/components/ui/floating-action-button', () => ({
  FloatingActionButton: ({
    label,
    onPress,
    children,
  }: {
    label: string;
    onPress: () => void;
    children: ReactNode;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: label, onPress },
      children ?? React.createElement(Text, null, label),
    );
  },
}));

jest.mock('@/components/ui/header-icon-button', () => ({
  HeaderIconButton: ({
    label,
    onPress,
    children,
  }: {
    label: string;
    onPress: () => void;
    children: ReactNode;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: label, onPress },
      children,
    );
  },
}));

jest.mock('@/components/ui/progress-bar', () => ({
  ProgressBar: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(View);
  },
}));
jest.mock('@/components/ui/progress-ring', () => ({
  ProgressRing: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(View);
  },
}));

jest.mock('@/components/ui/quantity-stepper', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View, Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    QuantityStepper: ({
      value,
      onChange,
      min,
      max,
    }: {
      value: number;
      onChange: (next: number) => void;
      min: number;
      max: number;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, `Menge: ${value}`),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Menge verringern',
            onPress: () => onChange(Math.max(min, value - 1)),
          },
          React.createElement(Text, null, 'Menge verringern'),
        ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Menge erhöhen',
            onPress: () => onChange(Math.min(max, value + 1)),
          },
          React.createElement(Text, null, 'Menge erhöhen'),
        ),
      ),
  };
});
jest.mock('@/features/settings/settings-menu', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SettingsGroup: ({ title, children }: { title: string; children: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
    SettingsRow: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: label, onPress },
        React.createElement(Text, null, label),
      ),
  };
});
jest.mock('@/hooks/use-sheet-shadow-style', () => ({ useSheetShadowStyle: () => ({}) }));
jest.mock('./pressable-callback-probe', () => ({
  PressableCallbackProbe: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(Text, null, 'Pressed style probe');
  },
}));
jest.mock('./showcase-shared', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const wrapper = ({ title, children }: { title?: string; children: ReactNode }) =>
    React.createElement(
      View,
      null,
      title ? React.createElement(Text, null, title) : null,
      children,
    );
  return {
    CodeSample: ({ children }: { children: ReactNode }) =>
      React.createElement(Text, null, children),
    ContractIntro: wrapper,
    ExamplePair: ({ correct, incorrect }: { correct: ReactNode; incorrect: ReactNode }) =>
      React.createElement(View, null, correct, incorrect),
    ExamplePanel: wrapper,
    Subsection: wrapper,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

function getButton(name: string, occurrence = 0) {
  const button = screen.getAllByRole('button', { name })[occurrence];
  if (!button) throw new Error(`Button not found: ${name} (${occurrence})`);
  return button;
}

it('renders and interacts with the surface and feedback categories', async () => {
  const user = userEvent.setup();
  await render(<ComponentsShowcase category="surfaces" />);

  expect(screen.getByText('Oberflächen und Karten')).toBeOnTheScreen();
  expect(screen.getByText('Synchronisiert')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: /cardBottom.*antippen/ }));
  await user.press(screen.getByRole('button', { name: /prominentCard.*antippen/ }));
  expect(screen.getByText('Zuletzt angetippt: prominentCard')).toBeOnTheScreen();

  await render(<ComponentsShowcase category="feedback" />);
  expect(screen.getByText('Status und Feedback')).toBeOnTheScreen();
  expect(screen.getByText('Noch nichts im Vorrat')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Eintrag anlegen' }));
  await user.press(screen.getByRole('button', { name: 'Produkt hinzufügen' }));
});

it('exercises controls, selection state, modal and sheet closures, and native choices', async () => {
  const user = userEvent.setup();
  await render(<ComponentsShowcase category="controls" />);

  expect(screen.getByText('Buttons, Felder und Auswahl')).toBeOnTheScreen();
  await user.press(getButton('Alle'));
  expect(screen.getByRole('button', { name: 'Alle ausgewählt' })).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
  expect(screen.getByText('Menge: 3')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Expo Bald fällig' }));
  await user.press(screen.getByRole('button', { name: 'Expo ungültige Auswahl' }));

  for (const label of [
    'Primäre Aktion',
    'Sekundäre Aktion',
    'Gefährliche Aktion',
    'Ghost-Aktion',
    'Akzentbereich',
    'Als Link',
    'Großer Button',
    'Kompakter Button',
    'Wird geladen',
    'Sortierung',
    'Filter öffnen',
    'Eintrag hinzufügen',
    'Alle zeigen',
    'Foundation Button',
    'Favorit',
    'Press-Primitiv',
    'Speichern',
  ]) {
    await user.press(screen.getByRole('button', { name: label }));
  }

  await user.press(getButton('Berechtigungen'));
  expect(screen.getByText('Zuletzt angetippt: Berechtigungen (Fam UI)')).toBeOnTheScreen();
  await user.press(getButton('Benachrichtigungen'));
  expect(screen.getByText('Zuletzt angetippt: Benachrichtigungen (Fam UI)')).toBeOnTheScreen();
  await user.press(getButton('Benachrichtigungen', 1));
  expect(screen.getByText('Zuletzt angetippt: Benachrichtigungen (Expo UI)')).toBeOnTheScreen();
  await user.press(getButton('Berechtigungen', 1));
  expect(screen.getByText('Zuletzt angetippt: Berechtigungen (Expo UI)')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Datum ändern' }));
  expect(screen.getByText('Auswahl: 11.10.2026')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Modal öffnen' }));
  expect(screen.getByText('Beispiel-Modal')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Modal schließen' }));
  await user.press(screen.getByRole('button', { name: 'Modal öffnen' }));
  await user.press(screen.getByRole('button', { name: 'Beispiel-Modal schließen' }));
  expect(screen.queryByText('Beispiel-Modal')).not.toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Öffnen (Eigenbau)' }));
  expect(screen.getByText('Beispiel-Sheet')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Schließen' }));
  await user.press(screen.getByRole('button', { name: 'Öffnen (Eigenbau)' }));
  await user.press(screen.getByRole('button', { name: 'Beispiel-Sheet schließen' }));
  expect(screen.queryByText('Beispiel-Sheet')).not.toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Bottom Sheet öffnen' }));
  await user.press(screen.getByRole('button', { name: 'Native sheet state change' }));
  await user.press(screen.getByRole('button', { name: 'Native sheet dismiss' }));
  await user.press(screen.getByRole('button', { name: 'Sheet schließen' }));
  await user.press(screen.getByRole('button', { name: 'Action Sheet öffnen' }));
  await user.press(screen.getByRole('button', { name: 'Bearbeiten' }));
  expect(screen.getByText('Bearbeiten gewählt.')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Action Sheet öffnen' }));
  await user.press(screen.getByRole('button', { name: 'Teilen' }));
  expect(screen.getByText('Teilen gewählt.')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Action Sheet öffnen' }));
  await user.press(screen.getByRole('button', { name: 'Löschen' }));
  expect(screen.getByText('Löschen gewählt.')).toBeOnTheScreen();
});
