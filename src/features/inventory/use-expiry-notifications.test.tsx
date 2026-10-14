import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useExpiryNotifications } from '@/features/inventory/use-expiry-notifications';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';

let inventoryItems: LocalInventoryItem[] = [];
const mockUseInventoryItems = jest.fn();
const mockGetNotificationSettings = jest.fn();
const mockScheduleExpiryNotificationReminder = jest.fn();

jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: (...args: unknown[]) => mockUseInventoryItems(...args),
}));
jest.mock('@/lib/platform/notifications', () => ({
  getNotificationSettings: () => mockGetNotificationSettings(),
  scheduleExpiryNotificationReminder: (...args: unknown[]) =>
    mockScheduleExpiryNotificationReminder(...args),
}));

function makeItem(id: string, expiry_date: string | null): LocalInventoryItem {
  return {
    id,
    household_id: 'household-1',
    location_id: null,
    product_id: null,
    name: id,
    quantity: 1,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    expiry_date,
    added_by: null,
    created_at: '2026-10-01T00:00:00.000Z',
    location_kind: null,
    location_name: null,
  };
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

beforeEach(() => {
  inventoryItems = [];
  mockUseInventoryItems.mockReset().mockImplementation(() => ({ data: inventoryItems }));
  mockGetNotificationSettings.mockReset().mockResolvedValue({
    enabled: true,
    daysThreshold: 10,
    reminderHour: 9,
    reminderMinute: 0,
  });
  mockScheduleExpiryNotificationReminder.mockReset().mockResolvedValue(undefined);
});

test('skips notification work without a household or items', async () => {
  await renderHook(() => useExpiryNotifications(undefined));
  expect(mockUseInventoryItems).toHaveBeenCalledWith(undefined);
  expect(mockGetNotificationSettings).not.toHaveBeenCalled();

  await renderHook(() => useExpiryNotifications('household-1'));
  expect(mockGetNotificationSettings).not.toHaveBeenCalled();
});

test('does not schedule reminders when the user has disabled them', async () => {
  inventoryItems = [makeItem('expired', isoDaysFromNow(-1))];
  mockGetNotificationSettings.mockResolvedValue({ enabled: false, daysThreshold: 10 });

  await renderHook(() => useExpiryNotifications('household-1'));

  await waitFor(() => expect(mockGetNotificationSettings).toHaveBeenCalledTimes(1));
  expect(mockScheduleExpiryNotificationReminder).not.toHaveBeenCalled();
});

test('schedules one reminder with expired, critical and soon items only', async () => {
  inventoryItems = [
    makeItem('no-date', null),
    makeItem('expired', isoDaysFromNow(-1)),
    makeItem('critical', isoDaysFromNow(0)),
    makeItem('soon', isoDaysFromNow(7)),
    makeItem('later', isoDaysFromNow(15)),
    makeItem('invalid', 'not-a-date'),
  ];
  const settings = { enabled: true, daysThreshold: 10, reminderHour: 9, reminderMinute: 0 };
  mockGetNotificationSettings.mockResolvedValue(settings);

  await renderHook(() => useExpiryNotifications('household-1'));

  await waitFor(() => expect(mockScheduleExpiryNotificationReminder).toHaveBeenCalledTimes(1));
  expect(mockScheduleExpiryNotificationReminder).toHaveBeenCalledWith(3, settings);
});

test('does not schedule after the hook is unmounted while settings are loading', async () => {
  let resolveSettings!: (settings: { enabled: boolean; daysThreshold: number }) => void;
  let settingsPromise!: Promise<{ enabled: boolean; daysThreshold: number }>;
  mockGetNotificationSettings.mockImplementation(() => {
    settingsPromise = new Promise((resolve) => (resolveSettings = resolve));
    return settingsPromise;
  });
  inventoryItems = [makeItem('expired', isoDaysFromNow(-1))];

  const { unmount } = await renderHook(() => useExpiryNotifications('household-1'));
  await waitFor(() => expect(mockGetNotificationSettings).toHaveBeenCalled());
  await act(async () => unmount());

  await act(async () => {
    resolveSettings({ enabled: true, daysThreshold: 10 });
    await settingsPromise;
    await Promise.resolve();
  });
  expect(mockScheduleExpiryNotificationReminder).not.toHaveBeenCalled();
});
