import type { ReactNode } from 'react';
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
  return (
    <GlassCard
      tinted
      accessibilityLabel={`${label} GlassCard`}
      glassStyle={styles.card}
      fallbackStyle={styles.card}>
      <Txt variant="subheading">{label}</Txt>
      <Txt variant="caption" tone="secondary">
        Beide sind getönt.
      </Txt>
    </GlassCard>
  );
}

export function ShadowsShowcase() {
  return (
    <View style={styles.page}>
      <View style={styles.example}>
        <Txt variant="title">Schatten in der App</Txt>
        <Txt variant="body" tone="secondary">
          Die Beispiele verwenden die Produktionskomponenten ohne Schatten.
        </Txt>
      </View>

      <ShadowExample
        label="DashboardCardShell"
        badge="ohne Schatten"
        tone="saved"
        description="Dashboard-Karten bleiben ohne Schatten. tinted steuert nur die Hintergrundtönung."
        code={'<DashboardCardShell size="small">…</DashboardCardShell>'}>
        <DashboardCardShell size="small" accessibilityLabel="Beispiel Dashboard-Karte">
          <View style={styles.dashboardContent}>
            <Txt variant="subheading">Dashboard-Karte</Txt>
            <Txt variant="caption" tone="secondary">
              ohne Schatten
            </Txt>
          </View>
        </DashboardCardShell>
      </ShadowExample>

      <ShadowExample
        label="GlassCard mit expliziter Auswahl"
        badge="ohne Schatten"
        tone="nourish"
        description="Beide Flächen haben tinted und keinen Schatten."
        code={'<GlassCard tinted … />'}>
        <GlassCardExample label="Normale Karte" />
        <GlassCardExample label="Prominente Karte" />
      </ShadowExample>

      <ShadowExample
        label="Von unten kommendes Sheet"
        badge="ohne Schatten"
        tone="nourish"
        description="Die Sheet-Fläche bleibt ohne Schatten."
        code={'style={styles.sheet}'}>
        <View style={styles.sheet}>
          <Txt variant="subheading">Sheet-Fläche</Txt>
          <Txt variant="caption" tone="secondary">
            Keine Schatten-Geometrie in der Oberfläche.
          </Txt>
        </View>
      </ShadowExample>
    </View>
  );
}
