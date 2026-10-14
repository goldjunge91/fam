import { render } from '@testing-library/react-native';
import { PerformanceMonitorDevTools } from './PerformanceMonitorDevTools';

jest.mock('@rozenite/performance-monitor-plugin', () => ({
  usePerformanceMonitorDevTools: jest.fn(),
}));

const performanceMonitorHook = jest.requireMock<{
  usePerformanceMonitorDevTools: jest.Mock;
}>('@rozenite/performance-monitor-plugin').usePerformanceMonitorDevTools;

describe('PerformanceMonitorDevTools', () => {
  beforeEach(() => {
    performanceMonitorHook.mockClear();
  });

  it('mounts the optional monitor hook in development and renders no UI', async () => {
    const result = await render(<PerformanceMonitorDevTools />);

    expect(result.toJSON()).toBeNull();
    expect(performanceMonitorHook).toHaveBeenCalledTimes(1);
  });
});
