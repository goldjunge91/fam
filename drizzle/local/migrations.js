// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20260826200344_worthless_celestials/migration.sql';
import m0001 from './20260826200418_living_talon/migration.sql';
import m0002 from './20260830014354_crazy_celestials/migration.sql';
import m0003 from './20260830133802_normal_pepper_potts/migration.sql';
import m0004 from './20260901043557_chunky_ken_ellis/migration.sql';

export default {
  migrations: {
    '20260826200344_worthless_celestials': m0000,
    '20260826200418_living_talon': m0001,
    '20260830014354_crazy_celestials': m0002,
    '20260830133802_normal_pepper_potts': m0003,
    '20260901043557_chunky_ken_ellis': m0004,
  },
};
