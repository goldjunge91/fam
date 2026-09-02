import {
  fetchLatestProfileWeight,
  profileLatestWeightQueryKey,
} from '@/features/profile/biometrics-api';
import { getSupabase } from '@/lib/supabase';

const mockEq = jest.fn();
const mockIs = jest.fn();
const mockLimit = jest.fn();
const mockMaybeSingle = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  is: mockIs,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
  order: mockOrder,
  select: mockSelect,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockIs.mockReturnValue(queryBuilder);
  mockLimit.mockReturnValue(queryBuilder);
  mockOrder.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: { id: 'weight-latest' }, error: null });
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

test('liest nur das neueste Gewicht des Account-Nutzers', async () => {
  await expect(fetchLatestProfileWeight('user-1')).resolves.toEqual({ id: 'weight-latest' });

  expect(mockFrom).toHaveBeenCalledWith('weight_entries');
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  expect(mockIs).toHaveBeenNthCalledWith(1, 'child_profile_id', null);
  expect(mockIs).toHaveBeenNthCalledWith(2, 'deleted_at', null);
  expect(mockOrder).toHaveBeenNthCalledWith(1, 'measured_on', { ascending: false });
  expect(mockOrder).toHaveBeenNthCalledWith(2, 'measured_at', {
    ascending: false,
    nullsFirst: false,
  });
});

test('verwendet einen profil-spezifischen Cache-Key', () => {
  expect(profileLatestWeightQueryKey('user-1')).toEqual(['profile', 'latest-weight', 'user-1']);
});
