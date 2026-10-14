import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { render } from '@testing-library/react-native';
import { type ComponentType, createElement } from 'react';

const appRoot = resolve(__dirname, '../../app');
const excludedRoutes = new Set(['_layout.tsx', '(app)/_layout.tsx', 'settings/product-search.tsx']);
const importedModulePattern = /from\s+['"](@\/[^'"]+)['"]/gu;
const routeParams = {
  id: 'route-id',
  receiptId: 'receipt-id',
  slug: 'route-slug',
  tier: 'ai',
  name: 'apples',
};
const mockRouteLeaf = jest.fn(() => null);
const mockRouteRedirect = jest.fn(() => null);
const mockRouteStackScreen = jest.fn(() => null);
const mockRouteStack = Object.assign(
  jest.fn(() => null),
  { Screen: mockRouteStackScreen },
);
const mockRouteSlot = jest.fn(() => null);
const routeComponentMocks = new Map<string, jest.Mock>();

function discoverRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discoverRoutes(path);
    const relativePath = relative(appRoot, path).replaceAll('\\', '/');
    return entry.isFile() && entry.name.endsWith('.tsx') && !excludedRoutes.has(relativePath)
      ? [path]
      : [];
  });
}

const routeFiles = discoverRoutes(appRoot).sort();

for (const routeFile of routeFiles) {
  const source = readFileSync(routeFile, 'utf8');
  for (const [, modulePath] of source.matchAll(importedModulePattern)) {
    if (modulePath === '@/components/module-gate') {
      jest.doMock(modulePath, () => ({ ModuleGate: mockRouteLeaf }));
      continue;
    }

    if (!modulePath.startsWith('@/features/')) continue;

    if (modulePath === '@/features/auth/session-provider') {
      jest.doMock(modulePath, () => ({
        useSession: () => ({ session: { user: { id: 'account-1' } }, isLoading: false }),
      }));
      continue;
    }

    if (modulePath === '@/features/household/active-household-provider') {
      jest.doMock(modulePath, () => ({
        useActiveHousehold: () => ({
          activeHousehold: { id: 'household-1' },
          activeHouseholdId: 'household-1',
        }),
      }));
      continue;
    }

    jest.doMock(modulePath, () => {
      const exports = new Proxy(
        { __esModule: true },
        {
          get(_target, key: string) {
            if (key === '__esModule') return true;
            const mockKey = `${modulePath}:${key}`;
            let component = routeComponentMocks.get(mockKey);
            if (!component) {
              component = mockRouteLeaf;
              routeComponentMocks.set(mockKey, component);
            }
            return component;
          },
        },
      );
      return exports;
    });
  }
}

jest.doMock('expo-router', () => ({
  Redirect: mockRouteRedirect,
  Slot: mockRouteSlot,
  Stack: mockRouteStack,
  useLocalSearchParams: () => routeParams,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

describe('Expo route wrappers', () => {
  it.each(routeFiles.map((path) => [relative(appRoot, path), path]))(
    'renders %s through its route boundary',
    async (_relativePath, routePath) => {
      mockRouteLeaf.mockClear();
      mockRouteRedirect.mockClear();
      mockRouteStack.mockClear();
      mockRouteStackScreen.mockClear();
      mockRouteSlot.mockClear();

      const Route = (require(routePath as string) as { default: ComponentType }).default;
      await render(createElement(Route));

      const boundaryRendered =
        mockRouteLeaf.mock.calls.length > 0 ||
        mockRouteRedirect.mock.calls.length > 0 ||
        mockRouteStack.mock.calls.length > 0 ||
        mockRouteSlot.mock.calls.length > 0;
      expect(boundaryRendered).toBe(true);
    },
  );
});
