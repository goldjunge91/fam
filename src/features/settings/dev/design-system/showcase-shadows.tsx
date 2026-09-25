import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Txt } from '@/constants/ui';
import { uiShadowStyles } from '@/constants/ui-shadow';
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

function GlassCardExample({ shadow }: { shadow: 'card' | 'prominent' }) {
  return (
    <GlassCard
      shadow={shadow}
      tinted
      accessibilityLabel={`${shadow} GlassCard`}
      glassStyle={styles.card}
      fallbackStyle={styles.card}>
      <Txt variant="subheading">{shadow === 'card' ? 'Normale Karte' : 'Prominente Karte'}</Txt>
      <Txt variant="caption" tone="secondary">
        Beide sind getönt; nur shadow wählt den Schatten.
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
          Die Beispiele verwenden die Produktionskomponenten und die exportierten uiShadowStyles.
          Schattenauswahl und Hintergrundtönung sind voneinander unabhängig.
        </Txt>
      </View>

      <ShadowExample
        label="DashboardCardShell"
        badge="prominentCard"
        tone="saved"
        description="Wie im Dashboard wird der Schatten direkt am Aufruf gewählt. tinted bleibt für die Hintergrundtönung zuständig."
        code={'<DashboardCardShell size="small" shadow="prominent">…</DashboardCardShell>'}>
        <DashboardCardShell
          size="small"
          shadow="prominent"
          accessibilityLabel="Beispiel Dashboard-Karte">
          <View style={styles.dashboardContent}>
            <Txt variant="subheading">Dashboard-Karte</Txt>
            <Txt variant="caption" tone="secondary">
              explizit shadow="prominent"
            </Txt>
          </View>
        </DashboardCardShell>
      </ShadowExample>

      <ShadowExample
        label="GlassCard mit expliziter Auswahl"
        badge="cardBottom / prominentCard"
        tone="nourish"
        description="Beide Flächen haben tinted. Die Prop shadow wählt unabhängig cardBottom oder prominentCard."
        code={'<GlassCard shadow="card" tinted … />\n<GlassCard shadow="prominent" tinted … />'}>
        <GlassCardExample shadow="card" />
        <GlassCardExample shadow="prominent" />
      </ShadowExample>

      <ShadowExample
        label="Von unten kommendes Sheet"
        badge="bottomSheetTop"
        tone="nourish"
        description="Das echte Sheet-Style liegt in uiShadowStyles; der Versatz zeigt nach oben und bleibt vierseitig weich."
        code={'style={[styles.sheet, uiShadowStyles.bottomSheetTop]}'}>
        <View style={[styles.sheet, uiShadowStyles.bottomSheetTop]}>
          <Txt variant="subheading">Sheet-Fläche</Txt>
          <Txt variant="caption" tone="secondary">
            Derselbe exportierte Stil wie bei den Produktions-Sheets.
          </Txt>
        </View>
      </ShadowExample>
    </View>
  );
}
