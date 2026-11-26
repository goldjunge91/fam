import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/screen';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { getLogicalDateForTimestamp } from '@/features/calorie-tracking/domain/day-boundary';
import { CorrelationSection } from '@/features/glp1/components/correlation-section';
import { useCorrelationSeries } from '@/features/glp1/hooks/correlation-api';
import { useProfile } from '@/features/profile/api';

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
  const { t } = useTranslation();
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
      title={t('glp1.correlation.title')}
      back={{ label: t('calorieTracking.diary.title'), href: '/diary' }}
      backStyle="icon">
      {isLoading ? (
        <Txt variant="caption" tone="secondary">
          {t('glp1.correlation.loading')}
        </Txt>
      ) : isError ? (
        <Txt variant="caption" tone="danger">
          {t('glp1.correlation.error')}
        </Txt>
      ) : series && series.length > 0 ? (
        <CorrelationSection series={series} />
      ) : (
        <Txt variant="caption" tone="secondary">
          {t('glp1.correlation.empty')}
        </Txt>
      )}
    </Screen>
  );
}
