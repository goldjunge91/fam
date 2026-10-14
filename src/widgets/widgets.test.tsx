import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import React, { type ReactNode } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Text as RNText, View } from 'react-native';
import QuickAddShoppingWidget, {
  type QuickAddShoppingWidgetProps,
} from './quick-add-shopping-widget';
import QuickAddShoppingWidgetWeb from './quick-add-shopping-widget.web';
import ShoppingListWidget, { type ShoppingListWidgetProps } from './shopping-list-widget';
import ShoppingListWidgetWeb from './shopping-list-widget.web';

jest.mock('expo-widgets', () => ({
  createWidget: jest.fn((name, layout) => ({ name, layout, updateSnapshot: jest.fn() })),
}));

const mockCreateWidget = jest.requireMock<{ createWidget: jest.Mock }>('expo-widgets').createWidget;

jest.mock('@expo/ui/swift-ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    HStack: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    VStack: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    Text: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
    Link: ({ label }: { label: string }) => React.createElement(Text, null, label),
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  background: () => null,
  font: () => null,
  foregroundStyle: () => null,
  padding: () => null,
}));
jest.mock('@/components/theme', () => ({
  getWidgetTheme: () => ({
    colors: {
      background: '#FFFFFF',
      title: '#171717',
      accent: '#7A5268',
      secondary: '#666666',
    },
    spacing: { inset: 12 },
    typography: {
      title: 18,
      count: 32,
      secondary: 12,
      mediumTitle: 20,
      mediumSecondary: 14,
    },
  }),
}));

describe('widget layouts', () => {
  it('shows a singular count in the small shopping-list widget', async () => {
    await render(
      renderSerializedWidget(
        'ShoppingListWidget',
        { openCount: 1 },
        { colorScheme: 'light', widgetFamily: 'systemSmall' },
      ),
    );

    expect(screen.getByText('Einkaufsliste')).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('offener Artikel')).toBeOnTheScreen();
  });

  it('shows the plural count and next-item fallback in the medium widget', async () => {
    await render(
      <>
        {renderSerializedWidget(
          'ShoppingListWidget',
          { openCount: 3 },
          { colorScheme: 'dark', widgetFamily: 'systemSmall' },
        )}
        {renderSerializedWidget(
          'ShoppingListWidget',
          { openCount: 3 },
          { colorScheme: 'dark', widgetFamily: 'systemMedium' },
        )}
      </>,
    );

    expect(screen.getByText('offene Artikel')).toBeOnTheScreen();
    expect(screen.getByText('Keine offenen Artikel')).toBeOnTheScreen();
  });

  it('uses a supplied next item and renders the quick-add link label', async () => {
    await render(
      <>
        {renderSerializedWidget(
          'ShoppingListWidget',
          { openCount: 2, nextItem: 'Milch' },
          { colorScheme: 'light', widgetFamily: 'systemMedium' },
        )}
        {renderSerializedWidget(
          'QuickAddShoppingWidget',
          { articleName: 'Tomaten' },
          { colorScheme: 'light', widgetFamily: 'systemSmall' },
        )}
      </>,
    );

    expect(screen.getByText('Milch')).toBeOnTheScreen();
    expect(screen.getByText('Schnell hinzufügen')).toBeOnTheScreen();
    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
  });

  it('accepts snapshot updates for the web widget adapters', () => {
    const shoppingListProps: ShoppingListWidgetProps = { openCount: 2, nextItem: 'Brot' };
    const quickAddProps: QuickAddShoppingWidgetProps = { articleName: 'Brot' };

    expect(() => ShoppingListWidgetWeb.updateSnapshot(shoppingListProps)).not.toThrow();
    expect(() => QuickAddShoppingWidgetWeb.updateSnapshot(quickAddProps)).not.toThrow();
    expect(ShoppingListWidget.updateSnapshot).toBeDefined();
    expect(QuickAddShoppingWidget.updateSnapshot).toBeDefined();
  });
});

function getWidgetSource(name: string): unknown {
  return mockCreateWidget.mock.calls.find(([widgetName]) => widgetName === name)?.[1];
}

function renderSerializedWidget(
  name: 'ShoppingListWidget' | 'QuickAddShoppingWidget',
  props: object,
  environment: object,
) {
  const source = getWidgetSource(name);
  if (typeof source !== 'string') {
    throw new TypeError('Expected the Expo widget compiler to serialize the layout function.');
  }

  const components = {
    VStack: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    HStack: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    Text: ({ children }: { children: ReactNode }) => React.createElement(RNText, null, children),
    Link: ({ label }: { label: string }) => React.createElement(RNText, null, label),
  };
  const modifiers = {
    padding: () => null,
    background: () => null,
    font: () => null,
    foregroundStyle: () => null,
  };
  const dependencies = {
    getWidgetTheme: () => ({
      colors: { background: '#fff', title: '#111', accent: '#715264', secondary: '#666' },
      spacing: { inset: 12 },
      typography: { title: 18, count: 30, secondary: 12, mediumTitle: 20, mediumSecondary: 14 },
    }),
    VStack: components.VStack,
    HStack: components.HStack,
    Text: components.Text,
    Link: components.Link,
    padding: modifiers.padding,
    background: modifiers.background,
    font: modifiers.font,
    foregroundStyle: modifiers.foregroundStyle,
    _jsx: jsx,
    _jsxs: jsxs,
  };
  const coverageIdentifier = source.match(/\bcov_[A-Za-z0-9_]+\b/)?.[0];
  const params = coverageIdentifier
    ? [coverageIdentifier, ...Object.keys(dependencies)]
    : Object.keys(dependencies);
  const args: unknown[] = [];
  let coverageData: Record<string, unknown> | undefined;

  if (coverageIdentifier) {
    const sourceFile =
      name === 'ShoppingListWidget'
        ? '/src/widgets/shopping-list-widget.tsx'
        : '/src/widgets/quick-add-shopping-widget.tsx';
    const registry = (
      globalThis as typeof globalThis & {
        __coverage__?: Record<string, Record<string, unknown>>;
      }
    ).__coverage__;
    coverageData = Object.entries(registry ?? {}).find(([path]) => path.endsWith(sourceFile))?.[1];

    if (!coverageData) {
      throw new Error(`Missing Jest coverage data for ${sourceFile}.`);
    }

    args.push(() => coverageData);
  }
  args.push(...Object.values(dependencies));

  const layout = new Function(...params, `return (${source});`)(...args) as (
    props: object,
    environment: object,
  ) => ReactElement;
  return layout(props, environment);
}
