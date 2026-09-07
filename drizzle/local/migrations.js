// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20260826200344_worthless_celestials/migration.sql';
import m0001 from './20260826200418_living_talon/migration.sql';
import m0002 from './20260830014354_crazy_celestials/migration.sql';
import m0003 from './20260830133802_normal_pepper_potts/migration.sql';
import m0004 from './20260901043557_chunky_ken_ellis/migration.sql';
import m0005 from './20260904072154_careful_bruce_banner/migration.sql';
import m0006 from './20260904080304_black_ego/migration.sql';
import m0007 from './20260907120000_inventory_expiry_user_set_backfill/migration.sql';
import m0008 from './20260906230504_open_doorman/migration.sql';

export default {
  migrations: {
    '20260826200344_worthless_celestials': m0000,
    '20260826200418_living_talon': m0001,
    '20260830014354_crazy_celestials': m0002,
    '20260830133802_normal_pepper_potts': m0003,
    '20260901043557_chunky_ken_ellis': m0004,
    '20260904072154_careful_bruce_banner': m0005,
    '20260904080304_black_ego': m0006,
    '20260906230504_open_doorman': m0008,
    '20260907120000_inventory_expiry_user_set_backfill': m0007,
  },
};
