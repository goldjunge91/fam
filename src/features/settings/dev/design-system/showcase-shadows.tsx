import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Txt } from '@/constants/ui';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';

const styles = StyleSheet.create((theme) => ({
  page: {
    gap: theme.space.xl,
  },
  example: {
    gap: theme.space.sm,
  },
  exampleHeader: {
    alignItems: 'flex-start',
    gap: theme.space.sm,
  },
  card: {
    minHeight: 112,
    justifyContent: 'center',
    gap: theme.space.xs,
    padding: theme.space.lg,
  },
  sheet: {
    minHeight: 100,
    justifyContent: 'center',
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.backgroundElement,
  },
  dashboardContent: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  code: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundSoft,
    overflow: 'hidden',
  },
}));

function ShadowExample({
  label,
  badge,
  tone,
  description,
  code,
  children,
}: {
  label: string;
  badge: string;
  tone: 'saved' | 'nourish';
  description: string;
  code: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.example}>
      <View style={styles.exampleHeader}>
        <Txt variant="heading">{label}</Txt>
        <Badge label={badge} tone={tone} />
      </View>
      <Txt variant="body" tone="secondary">
        {description}
      </Txt>
      {children}
      <View style={styles.code}>
        <Txt variant="caption" selectable>
          {code}
        </Txt>
      </View>
    </View>
  );
}

function GlassCardExample({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <GlassCard
      tinted
      accessibilityLabel={`${label} GlassCard`}
      glassStyle={styles.card}
      fallbackStyle={styles.card}>
      <Txt variant="subheading">{label}</Txt>
      <Txt variant="caption" tone="secondary">
        {t('dev.design.shadows.bothTinted')}
      </Txt>
    </GlassCard>
  );
}

export function ShadowsShowcase() {
  const { t } = useTranslation();

  return (
    <View style={styles.page}>
      <View style={styles.example}>
        <Txt variant="title">{t('dev.design.shadows.title')}</Txt>
        <Txt variant="body" tone="secondary">
          {t('dev.design.shadows.hint')}
        </Txt>
      </View>

      <ShadowExample
        label={t('dev.design.shadows.dashboard')}
        badge={t('dev.design.shadows.withoutShadow')}
        tone="saved"
        description={t('dev.design.shadows.tintedHint')}
        code={'<DashboardCardShell size="small">…</DashboardCardShell>'}>
        <DashboardCardShell size="small" accessibilityLabel={t('dev.design.shadows.dashboardCard')}>
          <View style={styles.dashboardContent}>
            <Txt variant="subheading">{t('dev.design.shadows.dashboardCard')}</Txt>
            <Txt variant="caption" tone="secondary">
              {t('dev.design.shadows.withoutShadow')}
            </Txt>
          </View>
        </DashboardCardShell>
      </ShadowExample>

      <ShadowExample
        label={t('dev.design.shadows.glass')}
        badge={t('dev.design.shadows.withoutShadow')}
        tone="nourish"
        description={t('dev.design.shadows.bothTinted')}
        code={'<GlassCard tinted … />'}>
        <GlassCardExample label={t('dev.design.shadows.normal')} />
        <GlassCardExample label={t('dev.design.shadows.prominent')} />
      </ShadowExample>

      <ShadowExample
        label={t('dev.design.shadows.sheet')}
        badge={t('dev.design.shadows.withoutShadow')}
        tone="nourish"
        description={t('dev.design.shadows.sheetHint')}
        code={'style={styles.sheet}'}>
        <View style={styles.sheet}>
          <Txt variant="subheading">{t('dev.design.shadows.sheetSurface')}</Txt>
          <Txt variant="caption" tone="secondary">
            {t('dev.design.shadows.noShadowGeometry')}
          </Txt>
        </View>
      </ShadowExample>
    </View>
  );
}
