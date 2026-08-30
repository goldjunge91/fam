import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { useSession } from '@/features/auth/session-provider';
import { CorrelationSection } from '@/features/glp1/components/correlation-section';
import { useCorrelationSeries } from '@/features/glp1/hooks/correlation-api';
import { useProfile } from '@/features/profile/api';
import { getLogicalDateForTimestamp } from '@/features/tracking/domain/day-boundary';

type CorrelationRouteParams = {
  logicalDate?: string;
  dayStartTime?: string;
  childProfileId?: string;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function CorrelationScreen() {
  const params = useLocalSearchParams<CorrelationRouteParams>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const dayStartTime =
    firstParam(params.dayStartTime) ?? profile?.tracking_day_start_time ?? '00:00';
  const logicalDate =
    firstParam(params.logicalDate) ?? getLogicalDateForTimestamp(new Date(), dayStartTime);
  const childProfileId = firstParam(params.childProfileId);
  const {
    data: series,
    isLoading,
    isError,
  } = useCorrelationSeries(userId, childProfileId, logicalDate, dayStartTime);

  return (
    <Screen
      title="Korrelationsanalyse"
      back={{ label: 'Tagebuch', href: '/diary' }}
      backStyle="icon">
      {isLoading ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Korrelationsanalyse wird geladen...
        </ThemedText>
      ) : isError ? (
        <ThemedText type="caption" themeColor="danger">
          Korrelationsanalyse konnte nicht geladen werden.
        </ThemedText>
      ) : series && series.length > 0 ? (
        <CorrelationSection series={series} />
      ) : (
        <ThemedText type="caption" themeColor="textSecondary">
          Keine Korrelationsdaten vorhanden.
        </ThemedText>
      )}
    </Screen>
  );
}
