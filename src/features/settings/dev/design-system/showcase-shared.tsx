import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Surface, Txt } from '@/constants/ui';

export function ContractIntro({
  title,
  contract,
  source,
}: {
  title: string;
  contract: string;
  source: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.intro}>
      <Txt variant="title">{title}</Txt>
      <Txt variant="body" tone="secondary">
        {contract}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {t('dev.design.shared.sourcePrefix', { source })}
      </Txt>
    </View>
  );
}

export function ExamplePair({
  correct,
  incorrect,
  correctCode,
  incorrectCode,
}: {
  correct: ReactNode;
  incorrect: ReactNode;
  correctCode?: string;
  incorrectCode?: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.stack}>
      <ExamplePanel kind="correct" label={t('dev.design.contractDone')} code={correctCode}>
        {correct}
      </ExamplePanel>
      <ExamplePanel kind="incorrect" label={t('dev.design.contractMissing')} code={incorrectCode}>
        {incorrect}
      </ExamplePanel>
    </View>
  );
}

export function ExamplePanel({
  kind,
  label,
  children,
  code,
}: {
  kind: 'correct' | 'incorrect' | 'neutral';
  label: string;
  children: ReactNode;
  code?: string;
}) {
  const { colors } = useTheme();
  const borderColor =
    kind === 'correct' ? colors.success : kind === 'incorrect' ? colors.danger : colors.border;

  return (
    <Surface tone="surface" accessibilityLabel={label} style={[styles.panel, { borderColor }]}>
      <View style={styles.panelHeader}>
        <View style={[styles.statusDot, { backgroundColor: borderColor }]} />
        <Txt
          variant="label"
          tone={kind === 'correct' ? 'success' : kind === 'incorrect' ? 'danger' : 'secondary'}>
          {label}
        </Txt>
      </View>
      <View style={styles.panelContent}>{children}</View>
      {code ? <CodeSample>{code}</CodeSample> : null}
    </Surface>
  );
}

export function CodeSample({ children }: { children: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel={t('dev.design.codeExample', { code: children })}
      style={[styles.code, { backgroundColor: colors.backgroundSoft }]}>
      <Txt variant="caption" selectable>
        {children}
      </Txt>
    </View>
  );
}

export function TokenGrid({ children }: { children: ReactNode }) {
  return <View style={styles.tokenGrid}>{children}</View>;
}

export function TokenItem({
  name,
  value,
  color,
  preview,
}: {
  name: string;
  value: string;
  color?: string;
  preview?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Surface tone="surface" style={[styles.token, { borderColor: colors.border }]}>
      {color ? (
        <View
          accessibilityLabel={t('dev.design.shared.colorPrefix', { name, value })}
          style={[styles.swatch, { backgroundColor: color, borderColor: colors.border }]}
        />
      ) : (
        preview
      )}
      <View style={styles.tokenText}>
        <Txt variant="caption" weight="700">
          {name}
        </Txt>
        <Txt variant="caption" tone="secondary" numberOfLines={2}>
          {value}
        </Txt>
      </View>
    </Surface>
  );
}

export function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="heading">{title}</Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: space.sm,
  },
  stack: {
    gap: space.md,
  },
  panel: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  panelContent: {
    gap: space.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  code: {
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  tokenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  token: {
    width: '48%',
    minWidth: 144,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.sm,
    gap: space.sm,
  },
  swatch: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  tokenText: {
    gap: 2,
  },
  section: {
    gap: space.md,
  },
});
