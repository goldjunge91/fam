import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const showcasePath = path.join(
  REPO_ROOT,
  'src/features/settings/dev/design-system/showcase-modals.tsx',
);
const swiftUIPath = path.join(
  REPO_ROOT,
  'src/features/settings/dev/design-system/showcase-modal-swift-ui.ios.tsx',
);
const contentPath = path.join(
  REPO_ROOT,
  'src/features/settings/dev/design-system/showcase-modal-content.tsx',
);

describe('modal comparison showcase', () => {
  it('keeps input and preview actions inside a scrollable hosted viewport', () => {
    const source = fs.readFileSync(contentPath, 'utf8');
    const scrollView = source.match(/<ScrollView([\s\S]*?)<\/ScrollView>/u)?.[1];

    expect(scrollView).toBeDefined();
    expect(scrollView).toContain('style={styles.scroll}');
    expect(scrollView).toContain('contentContainerStyle={styles.scrollContent}');
    expect(scrollView).toContain('<ModalComparisonContent');
    expect(source).toContain('hostedContent: {\n    flexGrow: 1,\n    height: 0,');
    expect(source).toContain('scroll: {\n    flex: 1,');
    expect(source).toContain('scrollContent: {\n    flexGrow: 1,');
    expect(source).toContain('testID={`design-system-natural-language-');
    expect(source).toContain('}-scroll`}');
    expect(source).toContain('<View style={styles.footer}>');
  });

  it('keeps the three implementations on one shared RN content surface', () => {
    const source = fs.readFileSync(showcasePath, 'utf8');

    expect(source).toContain("from '@expo/ui'");
    expect(source).toContain("from 'react-native'");
    expect(source).toContain("from './showcase-modal-content'");
    expect(source).toContain('<BottomSheet');
    expect(source).toContain('<Modal');
    expect(source).toContain('<ModalComparisonHostedContent');
    expect(source).toContain('<ModalComparisonScrollContent');
    expect(source).toContain('title="Voice"');
    expect(source).toContain("setMode('input')");
    expect(source).toContain("setMode('preview')");
    expect(source).toContain('containerColor={colors.backgroundElement}');
    expect(source).toContain('scrimColor={colors.scrim}');
  });

  it('uses the direct SwiftUI sheet with RNHostView and theme background', () => {
    const source = fs.readFileSync(swiftUIPath, 'utf8');

    expect(source).toContain("from '@expo/ui/swift-ui'");
    expect(source).toContain('<RNHostView>');
    expect(source).toContain('ModalComparisonHostedContent');
    expect(source).toContain('presentationDetents');
    expect(source).toContain('presentationBackground(colors.backgroundElement)');
    expect(source).toContain('onIsPresentedChange=');
    expect(source).toContain('ModalComparisonHostedContent');
    expect(source).toContain("mode={mode ?? 'preview'}");
  });
});
