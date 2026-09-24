import {
  fetchLatestProfileWeight,
  profileLatestWeightQueryKey,
} from '@/features/profile/biometrics-api';
import { getSupabase } from '@/lib/backend/supabase/remote-client';

const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  select: mockSelect,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: { id: 'weight-latest' }, error: null });
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

test('liest das einmalige Profilgewicht des Account-Nutzers', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { weight_kg: 80.5 }, error: null });

  await expect(fetchLatestProfileWeight('user-1')).resolves.toBe(80.5);

  expect(mockFrom).toHaveBeenCalledWith('profiles');
  expect(mockSelect).toHaveBeenCalledWith('weight_kg');
  expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
});

test('verwendet einen profil-spezifischen Cache-Key', () => {
  expect(profileLatestWeightQueryKey('user-1')).toEqual(['profile', 'latest-weight', 'user-1']);
});
