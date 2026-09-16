import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { dashboardCardSizes } from '@/components/theme/index';
import { i18n } from '@/i18n';
import { JiggleWrapper } from './jiggle-wrapper';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').Colors.light }),
}));

describe('JiggleWrapper', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('does not add a second fixed height around a large card', async () => {
    await render(
      <JiggleWrapper isEditing={false} index={0} size="large" onToggleSize={() => {}}>
        <View testID="large-card" style={{ minHeight: dashboardCardSizes.large.height }} />
      </JiggleWrapper>,
    );

    expect(screen.getByTestId('large-card').parent).not.toHaveStyle({
      height: dashboardCardSizes.large.height,
    });
  });

  it('does not add a second fixed height around a small card', async () => {
    await render(
      <JiggleWrapper isEditing={false} index={0} size="small" onToggleSize={() => {}}>
        <View testID="small-card" style={{ minHeight: dashboardCardSizes.small.height }} />
      </JiggleWrapper>,
    );

    expect(screen.getByTestId('small-card').parent).not.toHaveStyle({
      height: dashboardCardSizes.small.height,
    });
  });
});
