import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_SETTINGS_DIR = path.join(REPO_ROOT, 'src/app/settings');
const DEV_FEATURE_DIR = path.join(REPO_ROOT, 'src/features/settings/dev');
const DEV_MENU_PATH = path.join(DEV_FEATURE_DIR, 'dev-tools-screen.tsx');

const CATEGORY_SPECS = [
  {
    label: 'Umgebung & Zugang',
    route: '/settings/dev-environment',
    screenFile: 'dev-environment-screen.tsx',
    routeFile: 'dev-environment.tsx',
    componentName: 'DevEnvironmentScreen',
    sourceFiles: ['dev-environment-screen.tsx'],
    markers: ['<Card title="Umgebung">', '<Card title="Session">'],
  },
  {
    label: 'Overrides & Feature-Konfiguration',
    route: '/settings/dev-overrides',
    screenFile: 'dev-overrides-screen.tsx',
    routeFile: 'dev-overrides.tsx',
    componentName: 'DevOverridesScreen',
    sourceFiles: [
      'dev-overrides-screen.tsx',
      'feature-flag-controls.tsx',
      'tracking-method-controls.tsx',
    ],
    markers: [
      '<Card title="Plus, KI & Werbung">',
      '<Card title="Feature-Status">',
      '<FeatureFlagControls />',
      '<Card title="Analytics-Steuerung">',
      '<TrackingMethodControls />',
      '<Card title="Feature-Flags">',
      'title="Feature-Flag-Overrides zurücksetzen"',
      '<Card title="Tracking-Methoden-Steuerung">',
      'title="Tracking-Methoden-Overrides zurücksetzen"',
    ],
  },
  {
    label: 'Daten & Synchronisation',
    route: '/settings/dev-data',
    screenFile: 'dev-data-screen.tsx',
    routeFile: 'dev-data.tsx',
    componentName: 'DevDataScreen',
    sourceFiles: ['dev-data-screen.tsx'],
    markers: [
      '<Card title="Lokale Datenbank">',
      '<Card title="OpenFoodFacts-Dump">',
      'title="Neu einlesen"',
      'title="Lokale Datenbank löschen"',
      'title="Jetzt aktualisieren"',
      'title="Baseline neu installieren"',
      'title="Integrität prüfen"',
      'title="Sync-Diagnose & Outbox öffnen"',
      "router.push('/settings/sync-debug')",
    ],
  },
  {
    label: 'Telemetrie & Plattformtests',
    route: '/settings/dev-telemetry',
    screenFile: 'dev-telemetry-screen.tsx',
    routeFile: 'dev-telemetry.tsx',
    componentName: 'DevTelemetryScreen',
    sourceFiles: ['dev-telemetry-screen.tsx'],
    markers: [
      '<Card title="Testsignale">',
      'title="Sentry-Testfehler senden"',
      'title="Test-Benachrichtigung senden"',
      'title="EAS-Observe-Testevent senden"',
      'title="PostHog-Verbindung prüfen"',
      'title="Telemetrie-Testevent senden"',
    ],
  },
  {
    label: 'Vorschauen & Labs',
    route: '/settings/dev-previews',
    screenFile: 'dev-previews-screen.tsx',
    routeFile: 'dev-previews.tsx',
    componentName: 'DevPreviewsScreen',
    sourceFiles: ['dev-previews-screen.tsx'],
    markers: [
      '<Card title="Vorschauen">',
      'title="Design-System-Referenz öffnen"',
      'title="Drax-Drag-Demo öffnen"',
      'title="Auth-Seiten testen"',
      'title="Plus-Paywall öffnen (Test Store)"',
      'title="KI-Paywall öffnen (Test Store)"',
      "router.push('/settings/design-system')",
      "router.push('/settings/drax-demo')",
      "router.push('/settings/auth-preview')",
      "pathname: '/settings/plus-and-ai', params: { tier: 'plus' }",
      "pathname: '/settings/plus-and-ai', params: { tier: 'ai' }",
    ],
  },
] as const;

const menuSource = fs.readFileSync(DEV_MENU_PATH, 'utf8');

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function getStringProperty(object: ts.ObjectLiteralExpression, name: string): string | undefined {
  const property = object.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === name,
  );
  const initializer = property && unwrapExpression(property.initializer);
  return initializer && ts.isStringLiteral(initializer) ? initializer.text : undefined;
}

function parseCategoryEntries(source: string): Array<{ label: string; route: string }> {
  const sourceFile = ts.createSourceFile(
    DEV_MENU_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === 'DEV_CATEGORIES',
    );
  const initializer = declaration?.initializer && unwrapExpression(declaration.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) return [];

  return initializer.elements.flatMap((element) => {
    if (!ts.isObjectLiteralExpression(element)) return [];
    const label = getStringProperty(element, 'label');
    const route = getStringProperty(element, 'route');
    return label && route ? [{ label, route }] : [];
  });
}

const categoryEntries = parseCategoryEntries(menuSource);

describe('Dev-Menü-Kategorien', () => {
  it('definiert genau fünf Kategorien mit gültigen Route-Wrappern', () => {
    expect(categoryEntries).toEqual(CATEGORY_SPECS.map(({ label, route }) => ({ label, route })));

    for (const category of CATEGORY_SPECS) {
      const routeSource = fs.readFileSync(path.join(APP_SETTINGS_DIR, category.routeFile), 'utf8');
      expect(routeSource).toContain(
        `@/features/settings/dev/${category.screenFile.replace('.tsx', '')}`,
      );
      expect(routeSource).toContain(`return <${category.componentName} />`);
    }
  });

  it('rendert nur den Kategorie-Index ohne generischen Aktionen-Sammelpunkt', () => {
    expect(menuSource).toContain('router.push(category.route)');
    expect(menuSource).toContain('<SettingsGroup>');
    expect(menuSource).toContain('<SettingsRow');
    expect(menuSource).not.toContain('<Card');
    expect(menuSource).not.toContain('<Button');
    expect(menuSource).not.toContain('<SectionHeading');
    expect(menuSource).not.toContain('title="Aktionen"');
  });

  it('ordnet jede ausgelagerte Karte und Aktion genau einem Zielscreen zu', () => {
    const categorySources = new Map(
      CATEGORY_SPECS.map((category) => [
        category,
        category.sourceFiles.map((file) =>
          fs.readFileSync(path.join(DEV_FEATURE_DIR, file), 'utf8'),
        ),
      ]),
    );

    for (const category of CATEGORY_SPECS) {
      const sources = categorySources.get(category) ?? [];
      const source = sources.join('\n');
      expect(source).toContain(`title="${category.label}"`);
      expect(source).toContain("back={{ label: 'Entwickler', href: '/settings/dev' }}");
      expect(source).not.toContain('<Card title="Aktionen">');

      for (const marker of category.markers) {
        const owners = CATEGORY_SPECS.filter((candidate) =>
          categorySources
            .get(candidate)
            ?.some((candidateSource) => candidateSource.includes(marker)),
        );
        expect(owners).toHaveLength(1);
        expect(owners[0]).toBe(category);
      }
    }
  });
});
