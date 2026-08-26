import { createMMKV } from 'react-native-mmkv';
import { getDeviceStorage } from './device-storage';

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(),
}));

describe('device storage', () => {
  it('verwendet eine eigene unverschlüsselte Instanz nur für Geräte-UI', () => {
    const storage = { id: 'fam-device-v1' };
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    expect(getDeviceStorage()).toBe(storage);
    expect(getDeviceStorage()).toBe(storage);
    expect(createMMKV).toHaveBeenCalledTimes(1);
    expect(createMMKV).toHaveBeenCalledWith({
      id: 'fam-device-v1',
      mode: 'single-process',
    });
  });
});
